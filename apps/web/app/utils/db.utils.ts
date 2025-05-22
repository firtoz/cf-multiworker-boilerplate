import { drizzle } from "drizzle-orm/d1";
import type { AppLoadContext } from "react-router";
import * as schema from "../../db/schema";

/**
 * Get a Drizzle database instance from the context
 *
 * @param context The AppLoadContext from React Router
 * @returns A configured Drizzle instance with the schema
 */
export function getDb(context: AppLoadContext) {
	return drizzle(context.cloudflare.env.DB, { schema });
}
