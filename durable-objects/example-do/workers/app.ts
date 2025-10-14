import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@firtoz/hono-fetcher";
import { Hono } from "hono";

/**
 * Example Durable Object with Hono routing
 * Demonstrates basic DO structure with type-safe API
 */
export class ExampleDo extends DurableObject implements DOWithHonoApp {
	app = new Hono<{ Bindings: Env }>()
		// Health check
		.get("/", (c) =>
			c.json({
				status: "ExampleDo ready",
				message: "Hello World from ExampleDo!",
			}),
		)
		// Example: Get current count
		.get("/count", async (c) => {
			const count = (await this.ctx.storage.get<number>("count")) || 0;
			return c.json({ count });
		})
		// Example: Increment count
		.post("/count", async (c) => {
			const count = ((await this.ctx.storage.get<number>("count")) || 0) + 1;
			await this.ctx.storage.put("count", count);
			return c.json({ count });
		});

	/**
	 * Handle HTTP requests to this Durable Object
	 */
	fetch(request: Request): Response | Promise<Response> {
		return this.app.fetch(request, this.env);
	}
}

export default {
	fetch: () => new Response("Hello World from example-do!"),
};
