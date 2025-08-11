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
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	async fetch(request, env, ctx) {
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
} satisfies ExportedHandler<Env>;

// Re-export the ExampleDo class to make it available to Cloudflare Workers
// This is necessary for proper binding between workers
export { ExampleDo } from "example-do/workers/app";
