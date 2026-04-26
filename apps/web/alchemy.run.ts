import alchemy from "alchemy";
import { D1Database, ReactRouter } from "alchemy/cloudflare";
import { alchemyPassword } from "cf-starter-alchemy";
import { chatroomWorker } from "chatroom-do/alchemy";
import { otherWorker } from "other-worker/alchemy";
import { pingWorker } from "ping-do/alchemy";

const app = await alchemy("web", { password: alchemyPassword });

const db = await D1Database("main-db", {
	adopt: true,
	migrationsDir: new URL("../../packages/db/drizzle", import.meta.url).pathname,
});
const ChatroomDo = chatroomWorker.bindings.ChatroomDo;
const PingDo = pingWorker.bindings.PingDo;

export const web = await ReactRouter("cf-starter-web", {
	name: "cf-starter-web",
	main: "workers/app.ts",
	compatibility: "node",
	placement: { mode: "smart" },
	url: true,
	adopt: true,
	bindings: {
		DB: db,
		ChatroomDo,
		PingDo,
		PING: pingWorker,
		OTHER: otherWorker,
	},
});

console.log({ webUrl: web.url });

await app.finalize();
