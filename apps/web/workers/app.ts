import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler } from "react-router";

/**
 * Extend the AppLoadContext interface from react-router
 * to include Cloudflare-specific context
 */
declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	// @ts-expect-error - Virtual module is not typed
	() => import("virtual:react-router/server-build"),
	import.meta.env["MODE"],
);

const CHAT_WS_PREFIX = "/api/ws/";
const WORKER_SERVICES_PATH = "/api/worker-services";

function sanitizeChatRoomId(raw: string): string {
	const t = raw.trim().toLowerCase().slice(0, 64);
	if (t.length === 0 || !/^[a-z0-9_-]+$/.test(t)) {
		return "lobby";
	}
	return t;
}

/**
 * Web Application Worker Entrypoint: Socka WebSocket → Chatroom DO `/websocket`, else React Router.
 */
export default class WebAppWorker extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === WORKER_SERVICES_PATH) {
			const [pingOther, otherPing] = await Promise.all([
				this.env.PING.fetch("http://ping/other"),
				this.env.OTHER.fetch("http://other/ping"),
			]);
			return Response.json({
				pingOther: {
					ok: pingOther.ok,
					status: pingOther.status,
					body: await pingOther.text(),
				},
				otherPing: {
					ok: otherPing.ok,
					status: otherPing.status,
					body: await otherPing.text(),
				},
			});
		}
		if (url.pathname.startsWith(CHAT_WS_PREFIX)) {
			const rest = url.pathname.slice(CHAT_WS_PREFIX.length);
			const room = sanitizeChatRoomId(decodeURIComponent(rest));
			const stub = this.env.ChatroomDo.getByName(room);
			const forward = new URL(request.url);
			forward.pathname = "/websocket";
			return stub.fetch(new Request(forward.toString(), request));
		}
		return requestHandler(request, {
			cloudflare: { env: this.env, ctx: this.ctx },
		});
	}
}
