import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

/** Single logical row: id must stay `1` (global visit counter). */
export const siteVisits = sqliteTable("site_visits", {
	id: integer("id").primaryKey(),
	total: integer("total").notNull().default(0),
});
