import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Users table for storing application users
 */
export const usersTable = sqliteTable("users", {
	// User ID
	id: text().notNull().primaryKey(),

	// User information
	email: text().notNull().unique(),
	name: text(),

	// Timestamps
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Items table for storing generic items
 */
export const itemsTable = sqliteTable("items", {
	// Item ID
	id: text().notNull().primaryKey(),

	// Item information
	title: text().notNull(),
	description: text(),
	status: text({ enum: ["active", "archived", "deleted"] }).default("active"),

	// Relationships
	userId: text()
		.notNull()
		.references(() => usersTable.id),

	// Timestamps
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Tags table for categorizing items
 */
export const tagsTable = sqliteTable("tags", {
	// Tag ID
	id: text().notNull().primaryKey(),

	// Tag information
	name: text().notNull().unique(),
	color: text().default("gray"),

	// Timestamps
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Item tags junction table for many-to-many relationship between items and tags
 */
export const itemTagsTable = sqliteTable(
	"item_tags",
	{
		// References to the items and tags tables
		itemId: text()
			.notNull()
			.references(() => itemsTable.id, { onDelete: "cascade" }),
		tagId: text()
			.notNull()
			.references(() => tagsTable.id, { onDelete: "cascade" }),

		// When the tag was added to the item
		addedAt: integer({ mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		// Composite primary key of itemId and tagId
		// This ensures an item can only have a specific tag once
		primaryKey({ columns: [table.itemId, table.tagId] }),
	],
);

/**
 * Comments table for storing user comments on items
 */
export const commentsTable = sqliteTable("comments", {
	// Comment ID
	id: integer().primaryKey({ autoIncrement: true }),

	// Relationships
	userId: text()
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	itemId: text()
		.notNull()
		.references(() => itemsTable.id, { onDelete: "cascade" }),

	// Comment content
	content: text().notNull(),

	// Timestamps
	createdAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer({ mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

// Create Zod schemas for validation
export const insertUserSchema = createInsertSchema(usersTable);
export const insertItemSchema = createInsertSchema(itemsTable);
export const insertTagSchema = createInsertSchema(tagsTable);
export const insertCommentSchema = createInsertSchema(commentsTable);

// Export types for use in application code
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Item = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;

export type Tag = typeof tagsTable.$inferSelect;
export type NewTag = typeof tagsTable.$inferInsert;

export type Comment = typeof commentsTable.$inferSelect;
export type NewComment = typeof commentsTable.$inferInsert;
