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
	import.meta.env.MODE,
);

/**
 * Web Application Worker Entrypoint
 * Handles React Router SSR requests
 */
export default class WebAppWorker extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		return requestHandler(request, {
			cloudflare: { env: this.env, ctx: this.ctx },
		});
	}
}
