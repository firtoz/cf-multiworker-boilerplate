/// <reference types="@cloudflare/workers-types" />

import type { web } from "./alchemy.run";

export type CloudflareEnv = (typeof web)["Env"];

declare global {
	type Env = CloudflareEnv;
}

declare module "cloudflare:workers" {
	namespace Cloudflare {
		interface GlobalProps {}
		export interface Env extends CloudflareEnv {}
	}
}
