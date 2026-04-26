import { defineConfig } from "drizzle-kit";

/** D1: generate SQL with `bun run db:generate`; the web package Alchemy app applies migrations. */
export default defineConfig({
	schema: "./src/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	driver: "d1-http",
});
