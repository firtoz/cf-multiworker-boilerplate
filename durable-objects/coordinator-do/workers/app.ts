import { DurableObject } from "cloudflare:workers";
import type { DOWithHonoApp } from "@firtoz/hono-fetcher";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { Hono } from "hono";

type WorkItem = {
	id: string;
	payload: unknown;
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
		// Add work to queue
		.post("/queue", async (c) => {
			const payload = await c.req.json().catch(() => ({}));

			const workItem: WorkItem = {
				id: crypto.randomUUID(),
				payload,
				status: "pending",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			const queue = (await this.ctx.storage.get<WorkItem[]>("queue")) || [];
			queue.push(workItem);
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
		});

	/**
	 * Handle HTTP requests to this Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		return this.app.fetch(request, this.env);
	}

	/**
	 * Process a work item by delegating to ProcessorDo
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
			// Delegate to ProcessorDo using type-safe fetcher
			const processorApi = honoDoFetcherWithName(this.env.ProcessorDo, `processor-${workId}`);
			const response = await processorApi.post({
				url: "/process",
				body: workItem.payload,
			});

			const result = await response.json();

			// Update with result
			workItem.status = "completed";
			workItem.result = result;
			workItem.updatedAt = Date.now();
		} catch (error) {
			// Update with error
			workItem.status = "failed";
			workItem.error = error instanceof Error ? error.message : String(error);
			workItem.updatedAt = Date.now();
		}

		await this.ctx.storage.put("queue", queue);
	}
}

export default {
	fetch: () => new Response("Hello World from coordinator-do!"),
};
