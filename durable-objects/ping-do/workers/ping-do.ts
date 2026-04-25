import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";

/**
 * Minimal Durable Object used to validate a second cross-script DO + Vite auxiliary worker.
 */
export class PingDo extends DurableObject {
	readonly app = new Hono().get("/ping", (c) =>
		c.json({
			pong: true,
			id: c.req.header("x-do-id") ?? "unknown",
		}),
	);

	override async fetch(request: Request): Promise<Response> {
		const forwarded = new Request(request, {
			headers: new Headers(request.headers),
		});
		forwarded.headers.set("x-do-id", this.ctx.id.toString());
		return this.app.fetch(forwarded, this.env);
	}
}

export type PingDoRpc = Rpc.DurableObjectBranded & Pick<PingDo, "app">;
