import { defineConfig } from "drizzle-kit";

/** D1: generate SQL with `bun run db:generate` from repo root (filter cf-starter-db). Apply with `wrangler d1 migrations apply` (see README). */
export default defineConfig({
	schema: "./src/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
});
