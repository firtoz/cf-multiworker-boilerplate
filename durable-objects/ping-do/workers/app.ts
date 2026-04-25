import { WorkerEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";
import { PingDo } from "./ping-do";

export { PingDo };

const app = new Hono();

app.get("/other", async (c) => {
	const env = c.env as Env;
	const body = await env.OTHER.otherServiceAck();
	return c.text(`ping-do worker: /other → OTHER.otherServiceAck() → ${body}`);
});

/** Ping WorkerEntrypoint fetch (service binding target for `other-worker`). */
app.get("/ping-service-ack", (c) => c.text("ping-service-ack"));

export default class PingDoWorker extends WorkerEntrypoint<Env> {
	readonly app = app;

	async pingServiceAck(): Promise<string> {
		return "ping-service-ack";
	}

	async fetch(request: Request): Promise<Response> {
		return app.fetch(request, this.env, this.ctx);
	}
}
