import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import type { DOWithHonoApp } from "@firtoz/hono-fetcher";
import { zValidator } from "@hono/zod-validator";
import {
	type ProcessorResult,
	type QueueMessage,
	type TimestampEntry,
	type WorkPayload,
	workPayloadSchema,
	workResultSchema,
} from "do-common";
import { Hono } from "hono";
import { z } from "zod";

// Version number for coordinator storage schema
// If this changes, the DB will be cleared on next access
const COORDINATOR_VERSION = 1;

// Schema for batch submission
const batchSubmissionSchema = z.object({
	messages: z.array(z.string().min(1, "Message is required")).min(1).max(100),
	delay: z.number().min(0).max(5000),
	mode: z.enum(["queue", "direct"]).optional().default("queue"),
});

type WorkItem = {
	id: string;
	payload: WorkPayload;
	status: "pending" | "processing" | "completed" | "failed";
	createdAt: number;
	updatedAt: number;
	result?: ProcessorResult;
	error?: string;
	timestamps: TimestampEntry[];
	timeTaken?: number; // milliseconds from first timestamp to last
};

/**
 * Orchestrates work across multiple Durable Objects
 * Manages a queue of work items and delegates to processor DOs
 */
export class CoordinatorDo extends DurableObject<Env> implements DOWithHonoApp {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Block all incoming requests until migration is complete
		ctx.blockConcurrencyWhile(async () => {
			await this.checkAndMigrateVersion();
		});
	}

	app = new Hono<{ Bindings: Env }>()
		// Health check
		.get("/", (c) => c.json({ status: "CoordinatorDo ready" }))
		// Get queue status
		.get("/queue", async (c) => {
			const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
			return c.json({ queue });
		})
		// Add work to queue (with validation)
		.post(
			"/queue",
			zValidator(
				"json",
				workPayloadSchema.extend({
					mode: z.enum(["queue", "direct"]).optional().default("queue"),
				}),
			),
			async (c) => {
				const { mode, ...payload } = c.req.valid("json");

				// Use Date.now() for absolute timestamps - all timing starts here
				const serverReceivedTime = Date.now();

				// Initialize timestamps array starting from server entry point
				const timestamps: TimestampEntry[] = [];
				timestamps.push({
					tag: "1-serverReceived",
					time: serverReceivedTime,
				});

				const workItem: WorkItem = {
					id: crypto.randomUUID(),
					payload: { ...payload, timestamps },
					status: "pending",
					createdAt: Date.now(),
					updatedAt: Date.now(),
					timestamps,
				};

				const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
				queue.push(workItem);

				// Keep only the most recent 50 items
				if (queue.length > 50) {
					queue.splice(0, queue.length - 50);
				}

				await this.ctx.storage.put("queue", queue);

				// Process asynchronously (don't await)
				this.ctx.waitUntil(this.processWork(workItem.id, mode));

				return c.json({ workItem });
			},
		)
		// Batch add work to queue (with validation)
		.post("/queue/batch", zValidator("json", batchSubmissionSchema), async (c) => {
			const { messages, delay, mode = "queue" } = c.req.valid("json");

			const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
			const workItems: WorkItem[] = [];
			const baseTime = Date.now();

			for (let i = 0; i < messages.length; i++) {
				const timestamps: TimestampEntry[] = [];
				timestamps.push({
					tag: "1-serverReceived",
					time: baseTime, // All received at the same time in batch
				});

				const message = messages[i];
				if (!message) {
					continue;
				}

				const workItem: WorkItem = {
					id: crypto.randomUUID(),
					payload: { message, delay, timestamps },
					status: "pending",
					createdAt: Date.now(),
					updatedAt: Date.now(),
					timestamps,
				};

				workItems.push(workItem);
				queue.push(workItem);
			}

			// Keep only the most recent 50 items
			if (queue.length > 50) {
				queue.splice(0, queue.length - 50);
			}

			await this.ctx.storage.put("queue", queue);

			// Process all items asynchronously
			for (const item of workItems) {
				this.ctx.waitUntil(this.processWork(item.id, mode));
			}

			return c.json({ workItems, count: workItems.length });
		})
		// Process specific work item
		.post("/process/:workId", async (c) => {
			const workId = c.req.param("workId");
			await this.processWork(workId);
			return c.json({ success: true });
		})
		// Update work result (called by ProcessorDo) - with validation
		.post("/result/:workId", zValidator("json", workResultSchema), async (c) => {
			const workId = c.req.param("workId");
			const body = c.req.valid("json");
			await this.updateWorkResult(workId, body.result, body.error, body.timestamps);
			return c.json({ success: true });
		});

	/**
	 * Handle HTTP requests to this Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request, this.env);
	}

	/**
	 * Check if storage version matches current version, clear DB if not
	 */
	private async checkAndMigrateVersion() {
		const storedVersion = await this.ctx.storage.get<number>("version");
		if (storedVersion !== COORDINATOR_VERSION) {
			console.warn(
				`Version mismatch (stored: ${storedVersion}, current: ${COORDINATOR_VERSION}). Clearing storage...`,
			);
			await this.ctx.storage.deleteAll();
			await this.ctx.storage.put("version", COORDINATOR_VERSION);
		}
	}

	/**
	 * Process a work item by sending to queue or directly to processor
	 */
	private async processWork(workId: string, mode: "queue" | "direct" = "queue") {
		const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
		const workItem = queue.find((item) => item.id === workId);

		if (!workItem || workItem.status !== "pending") {
			return;
		}

		// Update status to processing
		workItem.status = "processing";
		workItem.updatedAt = Date.now();

		if (mode === "direct") {
			// Direct messaging to ProcessorDo
			const directSendTime = Date.now();
			workItem.timestamps.push({
				tag: `${workItem.timestamps.length + 1}-directSend-rpc`,
				time: directSendTime,
			});

			await this.ctx.storage.put("queue", queue);

			try {
				const stub = this.env.ProcessorDo.getByName(`processor-${this.ctx.id}`);
				const result = await stub.processWork(workItem.payload);

				// Update work result directly - result is the whole response from ProcessorDo
				await this.updateWorkResult(workItem.id, result, undefined, result?.timestamps);
			} catch (error) {
				// Update with error if direct call fails
				workItem.status = "failed";
				workItem.error = error instanceof Error ? error.message : String(error);
				workItem.updatedAt = Date.now();
				await this.ctx.storage.put("queue", queue);
			}
		} else {
			// Queue mode - send to Cloudflare Queue
			const queueEnqueueTime = Date.now();
			workItem.timestamps.push({
				tag: `${workItem.timestamps.length + 1}-queueEnqueued`,
				time: queueEnqueueTime,
			});

			await this.ctx.storage.put("queue", queue);

			try {
				// Send to Cloudflare Queue for processing
				await this.env.WORK_QUEUE.send({
					workId: workItem.id,
					payload: workItem.payload,
					coordinatorId: this.ctx.id.toString(),
					timestamps: workItem.timestamps,
				} satisfies QueueMessage);
			} catch (error) {
				// Update with error if queue send fails
				workItem.status = "failed";
				workItem.error = error instanceof Error ? error.message : String(error);
				workItem.updatedAt = Date.now();
				await this.ctx.storage.put("queue", queue);
			}
		}
	}

	/**
	 * Endpoint for ProcessorDo to report results back
	 */
	async updateWorkResult(
		workId: string,
		result?: ProcessorResult,
		error?: string,
		timestamps?: TimestampEntry[],
	) {
		const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
		const workItem = queue.find((item) => item.id === workId);

		if (!workItem) {
			return;
		}

		// Merge timestamps from processor
		if (timestamps) {
			workItem.timestamps = timestamps;
		}

		if (error) {
			workItem.status = "failed";
			workItem.error = error;
		} else {
			workItem.status = "completed";
			if (result !== undefined) {
				workItem.result = result;
			}
		}

		// Calculate timeTaken from first to last timestamp
		if (workItem.timestamps.length > 1) {
			const firstTimestamp = workItem.timestamps[0];
			const lastTimestamp = workItem.timestamps[workItem.timestamps.length - 1];
			if (firstTimestamp && lastTimestamp) {
				workItem.timeTaken = lastTimestamp.time - firstTimestamp.time;
			}
		}

		workItem.updatedAt = Date.now();
		await this.ctx.storage.put("queue", queue);
	}
}

/**
 * Worker Entrypoint
 * Handles incoming HTTP requests
 */
export default class CoordinatorWorker extends WorkerEntrypoint<Env> {
	/**
	 * Handle HTTP requests to the worker
	 */
	async fetch(_request: Request): Promise<Response> {
		return new Response("Hello World from coordinator-do!", {
			headers: { "Content-Type": "text/plain" },
		});
	}
}
