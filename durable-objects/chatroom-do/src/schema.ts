import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatMessagesTable = sqliteTable("chat_messages", {
	id: text("id").primaryKey(),
	ts: integer("ts", { mode: "number" }).notNull(),
	userId: text("user_id").notNull(),
	displayName: text("display_name").notNull(),
	text: text("text").notNull(),
});
