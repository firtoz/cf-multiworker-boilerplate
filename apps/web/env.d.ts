/// <reference types="@cloudflare/workers-types" />

import type { web } from "./alchemy.run";

export type CloudflareEnv = (typeof web)["Env"];

type StringifyValues<EnvType extends Record<string, unknown>> = {
	[Binding in keyof EnvType]: EnvType[Binding] extends string
		? EnvType[Binding]
		: string;
};

declare global {
	type Env = CloudflareEnv;
}

declare namespace NodeJS {
	interface ProcessEnv extends StringifyValues<Pick<CloudflareEnv, "SESSION_SECRET">> {}
}

declare module "cloudflare:workers" {
	namespace Cloudflare {
		interface GlobalProps {}
		export interface Env extends CloudflareEnv {}
	}
}
