import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import type { DOWithHonoApp } from "@firtoz/hono-fetcher";
import { zValidator } from "@hono/zod-validator";
import {
	type QueueMessage,
	type WorkPayload,
	workPayloadSchema,
	workResultSchema,
} from "do-common";
import { Hono } from "hono";

type WorkItem = {
	id: string;
	payload: WorkPayload;
	status: "pending" | "processing" | "completed" | "failed";
	createdAt: number;
	updatedAt: number;
	result?: unknown;
	error?: string;
};

/**
 * Orchestrates work across multiple Durable Objects
 * Manages a queue of work items and delegates to processor DOs
 */
export class CoordinatorDo extends DurableObject<Env> implements DOWithHonoApp {
	app = new Hono<{ Bindings: Env }>()
		// Health check
		.get("/", (c) => c.json({ status: "CoordinatorDo ready" }))
		// Get queue status
		.get("/queue", async (c) => {
			const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
			return c.json({ queue });
		})
		// Add work to queue (with validation)
		.post("/queue", zValidator("json", workPayloadSchema), async (c) => {
			const payload = c.req.valid("json");

			const workItem: WorkItem = {
				id: crypto.randomUUID(),
				payload,
				status: "pending",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
			queue.push(workItem);

			// Keep only the most recent 10 items
			if (queue.length > 10) {
				queue.splice(0, queue.length - 10);
			}

			await this.ctx.storage.put("queue", queue);

			// Process asynchronously (don't await)
			this.ctx.waitUntil(this.processWork(workItem.id));

			return c.json({ workItem });
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
			await this.updateWorkResult(workId, body.result, body.error);
			return c.json({ success: true });
		});

	/**
	 * Handle HTTP requests to this Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request, this.env);
	}

	/**
	 * Process a work item by sending to queue
	 */
	private async processWork(workId: string) {
		const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
		const workItem = queue.find((item) => item.id === workId);

		if (!workItem || workItem.status !== "pending") {
			return;
		}

		// Update status to processing
		workItem.status = "processing";
		workItem.updatedAt = Date.now();
		await this.ctx.storage.put("queue", queue);

		try {
			// Send to Cloudflare Queue for processing
			await this.env.WORK_QUEUE.send({
				workId: workItem.id,
				payload: workItem.payload,
				coordinatorId: "main-coordinator", // Allow processor to send results back
			} satisfies QueueMessage);
		} catch (error) {
			// Update with error if queue send fails
			workItem.status = "failed";
			workItem.error = error instanceof Error ? error.message : String(error);
			workItem.updatedAt = Date.now();
			await this.ctx.storage.put("queue", queue);
		}
	}

	/**
	 * Endpoint for ProcessorDo to report results back
	 */
	async updateWorkResult(workId: string, result: unknown, error?: string) {
		const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
		const workItem = queue.find((item) => item.id === workId);

		if (!workItem) {
			return;
		}

		if (error) {
			workItem.status = "failed";
			workItem.error = error;
		} else {
			workItem.status = "completed";
			workItem.result = result;
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
