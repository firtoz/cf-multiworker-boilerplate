import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";
import type { CloudflareEnv } from "../env";

const app = new Hono<{ Bindings: CloudflareEnv }>();

/**
 * Other worker calls the ping **service** (WorkerEntrypoint), not the Ping DO.
 */
app.get("/ping", async (c) => {
	const body = await c.env.PING.pingServiceAck();
	return c.text(`other-worker: PING.pingServiceAck() → ${body}`);
});

app.get("/other-service-ack", (c) => c.text("other-service-ack"));

export default class OtherWorker extends WorkerEntrypoint<Env> {
	readonly app = app;

	async otherServiceAck(): Promise<string> {
		return "other-service-ack";
	}

	async fetch(request: Request): Promise<Response> {
		return app.fetch(request, this.env, this.ctx);
	}
}
