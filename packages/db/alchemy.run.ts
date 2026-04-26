import alchemy from "alchemy";
import { D1Database } from "alchemy/cloudflare";
import { alchemyPassword } from "cf-starter-alchemy";

const app = await alchemy("cf-starter-db", { password: alchemyPassword });

export const mainDb = await D1Database("main-db", {
	adopt: true,
	migrationsDir: new URL("./drizzle", import.meta.url).pathname,
});

console.log({ app: "cf-starter-db", d1: mainDb.name });

await app.finalize();
