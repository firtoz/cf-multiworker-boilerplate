import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@firtoz/hono-fetcher";
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
		// Process work
		.post("/process", async (c) => {
			const payload = await c.req.json().catch(() => ({}));

			// TODO: Replace with your actual processing logic
			// Simulate some work
			const delay = (payload as { delay?: number }).delay || 1000;
			await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5000)));

			// Track processing count
			const processCount = ((await this.ctx.storage.get<number>("processCount")) || 0) + 1;
			await this.ctx.storage.put("processCount", processCount);

			const result = {
				processed: true,
				input: payload,
				processedAt: Date.now(),
				processCount,
				message: `Processed by ProcessorDo (total: ${processCount})`,
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

export default {
	fetch: () => new Response("Hello World from processor-do!"),
};
