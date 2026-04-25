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
const sessionSecretRaw = process.env["SESSION_SECRET"];
if (sessionSecretRaw == null || sessionSecretRaw === "") {
	throw new Error(
		"SESSION_SECRET is not set. Run `bun run setup` (or `bun run setup:prod`) at the repository root, or set SESSION_SECRET in the environment (e.g. .env.local / .env.production).",
	);
}
const sessionSecret = alchemy.secret(sessionSecretRaw);
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
		SESSION_SECRET: sessionSecret,
		ChatroomDo,
		PingDo,
		PING: pingWorker,
		OTHER: otherWorker,
	},
});

console.log({ webUrl: web.url });

await app.finalize();
