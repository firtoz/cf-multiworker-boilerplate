import { defineConfig } from "drizzle-kit";

export default process.env.LOCAL_DB_PATH
	? defineConfig({
			schema: "./db/schema.ts",
			dialect: "sqlite",
			dbCredentials: {
				url: process.env.LOCAL_DB_PATH || "",
			},
		})
	: defineConfig({
			schema: "./db/schema.ts",
			out: "./drizzle/migrations",
			dialect: "sqlite",
			driver: "d1-http",
			verbose: true,
			strict: true,
		});
