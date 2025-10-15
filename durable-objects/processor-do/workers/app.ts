import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import { type DOWithHonoApp, honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { zValidator } from "@hono/zod-validator";
import { type QueueMessage, workPayloadSchema } from "do-common";
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

			// Payload is now validated and fully typed
			// You get type hinting for payload.message and payload.delay
			const { delay, message } = payload;

			// TODO: Replace with your actual processing logic
			// Simulate some work
			await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5000)));

			// Track processing count
			const processCount = ((await this.ctx.storage.get<number>("processCount")) || 0) + 1;
			await this.ctx.storage.put("processCount", processCount);

			const result = {
				processed: true,
				input: payload,
				processedAt: Date.now(),
				processCount,
				message: `Processed "${message}" by ProcessorDo (total: ${processCount})`,
			};

			return c.json(result);
		});

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
	 * Processes messages from the work queue
	 */
	async queue(batch: MessageBatch<QueueMessage>): Promise<void> {
		for (const message of batch.messages) {
			try {
				const { workId, payload, coordinatorId } = message.body;

				// Use hono-fetcher to call ProcessorDo
				const processorApi = honoDoFetcherWithName(this.env.ProcessorDo, `processor-${workId}`);
				const response = await processorApi.post({
					url: "/process",
					body: payload,
				});
				const result = await response.json();

				// Send result back to coordinator using hono-fetcher
				const coordinatorApi = honoDoFetcherWithName(this.env.CoordinatorDo, coordinatorId);
				await coordinatorApi.post({
					url: "/result/:workId",
					params: { workId },
					body: { result },
				});

				// Acknowledge message
				message.ack();
			} catch (error) {
				// Send error back to coordinator
				try {
					const { workId, coordinatorId } = message.body;
					const coordinatorApi = honoDoFetcherWithName(this.env.CoordinatorDo, coordinatorId);
					await coordinatorApi.post({
						url: "/result/:workId",
						params: { workId },
						body: { error: error instanceof Error ? error.message : String(error) },
					});
				} catch (reportError) {
					console.error("Failed to report error to coordinator:", reportError);
				}

				// Retry the message
				message.retry();
			}
		}
	}
}
