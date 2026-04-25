// @see https://alchemy.run/concepts/bindings/#type-safe-bindings
/// <reference types="@cloudflare/workers-types" />

import type { pingWorker } from "./alchemy.run";

export type CloudflareEnv = (typeof pingWorker)["Env"];

declare global {
	type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
	namespace Cloudflare {
		interface GlobalProps {}
		export interface Env extends CloudflareEnv {}
	}
}
