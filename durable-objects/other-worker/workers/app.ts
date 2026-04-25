import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";

const app = new Hono();

/**
 * Other worker calls the ping **service** (WorkerEntrypoint), not the Ping DO.
 */
app.get("/ping", async (c) => {
	const env = c.env as Env;
	const body = await env.PING.pingServiceAck();
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
