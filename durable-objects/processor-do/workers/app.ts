import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { type DOWithHonoApp, honoDoFetcherWithId } from "@firtoz/hono-fetcher";
import { zValidator } from "@hono/zod-validator";
import {
	type QueueMessage,
	type TimestampEntry,
	type WorkPayload,
	workPayloadSchema,
} from "do-common";
import { Hono } from "hono";

/**
 * Processes work delegated from coordinator
 * Simulates work processing with configurable delay
 */
export class ProcessorDo extends DurableObject<Env> implements DOWithHonoApp {
	app = new Hono<{ Bindings: Env }>()
		// Health check
		.get("/", (c) => c.json({ status: "ProcessorDo ready" }))
		// Get stats
		.get("/stats", async (c) => {
			const processCount = (await this.ctx.storage.get<number>("processCount")) || 0;
			return c.json({ processCount });
		})
		// Process work (with validation)
		.post("/process", zValidator("json", workPayloadSchema), async (c) => {
			const payload = c.req.valid("json");

			const result = await this.processWork(payload);

			return c.json(result);
		});

	async processWork(payload: WorkPayload) {
		const processingStartTime = Date.now();

		// Payload is now validated and fully typed
		// You get type hinting for payload.message and payload.delay
		const { delay, message, timestamps = [] } = payload;

		// Add processing start timestamp
		const updatedTimestamps: TimestampEntry[] = [...timestamps];
		updatedTimestamps.push({
			tag: `${updatedTimestamps.length + 1}-processingStarted`,
			time: processingStartTime,
		});

		// TODO: Replace with your actual processing logic
		// Simulate some work (allow 0 delay for benchmarking)
		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5000)));
		}

		const processingCompletedTime = Date.now();

		// Add processing completed timestamp
		updatedTimestamps.push({
			tag: `${updatedTimestamps.length + 1}-processingCompleted`,
			time: processingCompletedTime,
		});

		// Track processing count
		const processCount = ((await this.ctx.storage.get<number>("processCount")) || 0) + 1;
		await this.ctx.storage.put("processCount", processCount);

		const result = {
			processed: true,
			input: payload,
			processedAt: Date.now(),
			processCount,
			message: `Processed "${message}" by ProcessorDo (total: ${processCount})`,
			timestamps: updatedTimestamps,
		};
		return result;
	}

	/**
	 * Handle HTTP requests to this Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request, this.env);
	}
}

/**
 * Worker Entrypoint
 * Handles queue consumption and routes to Durable Objects
 */
export default class ProcessorWorker extends WorkerEntrypoint<Env> {
	/**
	 * Handle HTTP requests to the worker
	 */
	async fetch(_request: Request): Promise<Response> {
		return new Response("Hello World from processor-do!", {
			headers: { "Content-Type": "text/plain" },
		});
	}

	/**
	 * Queue consumer handler
	 * Handles both regular queue and dead letter queue messages
	 */
	async queue(batch: MessageBatch<QueueMessage>): Promise<void> {
		// Handle DLQ messages - these are permanent failures
		if (batch.queue === "work-queue-dlq") {
			await Promise.all(
				batch.messages.map(async (message) => {
					try {
						const { workId, coordinatorId, timestamps } = message.body;

						// Add timestamp for when message reached DLQ
						const dlqTime = Date.now();
						const finalTimestamps: TimestampEntry[] = [...timestamps];
						finalTimestamps.push({
							tag: `${finalTimestamps.length + 1}-reachedDLQ`,
							time: dlqTime,
						});

						// Report permanent failure to coordinator
						const coordinatorApi = honoDoFetcherWithId(this.env.CoordinatorDo, coordinatorId);
						await coordinatorApi.post({
							url: "/result/:workId",
							params: { workId },
							body: {
								error: "Message failed after all retry attempts",
								timestamps: finalTimestamps,
							},
						});

						// Acknowledge the DLQ message
						message.ack();
					} catch (error) {
						console.error(`Failed to report DLQ message to coordinator:`, error);
						// Don't retry DLQ messages - just log and move on
						message.ack();
					}
				}),
			);
			return;
		}

		// Handle regular queue messages
		await Promise.all(
			batch.messages.map(async (message) => {
				try {
					const { workId, payload, coordinatorId, timestamps } = message.body;

					// Add timestamp for when consumer picked up the message
					const consumerPickedUpTime = Date.now();
					const updatedTimestamps: TimestampEntry[] = [...timestamps];
					updatedTimestamps.push({
						tag: `${updatedTimestamps.length + 1}-consumerPickedUp`,
						time: consumerPickedUpTime,
					});

					const stub = this.env.ProcessorDo.getByName(`processor-${coordinatorId}`);
					const result = await stub.processWork(payload);

					// Send result back to coordinator using hono-fetcher (result should include timestamps)
					const coordinatorApi = honoDoFetcherWithId(this.env.CoordinatorDo, coordinatorId);
					await coordinatorApi.post({
						url: "/result/:workId",
						params: { workId },
						body: { result, timestamps: result.timestamps },
					});

					// Acknowledge message
					message.ack();
				} catch (error) {
					// Log error but don't report to coordinator yet
					// Let the message retry automatically (up to max_retries)
					// If all retries fail, it will go to the DLQ where we handle permanent failures
					console.error(`Failed to process message ${message.body.workId}:`, error);
					message.retry();
				}
			}),
		);
	}
}
