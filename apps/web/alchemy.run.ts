import alchemy from "alchemy";
import {
	D1Database,
	type DurableObjectNamespace,
	ReactRouter,
	type ReactRouter as ReactRouterResource,
} from "alchemy/cloudflare";
import { chatroomWorker } from "chatroom-do/alchemy";
import { otherWorker } from "other-worker/alchemy";
import { pingWorker } from "ping-do/alchemy";
import type { PingDoRpc } from "ping-do/workers/ping-do";
import { alchemyPassword } from "../../alchemy/password";

const app = await alchemy("web", { password: alchemyPassword });

const db = await D1Database("main-db", {
	migrationsDir: new URL("../../packages/db/drizzle", import.meta.url).pathname,
});
const sessionSecret = alchemy.secret(process.env["SESSION_SECRET"] ?? "dev-only-change-me");
const ChatroomDo = chatroomWorker.bindings.ChatroomDo;
const PingDo: DurableObjectNamespace<PingDoRpc> = pingWorker.bindings.PingDo;

type WebBindings = {
	DB: typeof db;
	SESSION_SECRET: typeof sessionSecret;
	ChatroomDo: typeof ChatroomDo;
	PingDo: typeof PingDo;
	PING: typeof pingWorker;
	OTHER: typeof otherWorker;
};

export const web: ReactRouterResource<WebBindings> = await ReactRouter("cf-starter-web", {
	name: "cf-starter-web",
	main: "workers/app.ts",
	compatibility: "node",
	placement: { mode: "smart" },
	url: true,
	adopt: true,
	bindings: {
		DB: db,
		SESSION_SECRET: sessionSecret,
		ChatroomDo,
		PingDo,
		PING: pingWorker,
		OTHER: otherWorker,
	},
});

console.log({ webUrl: web.url });

await app.finalize();
