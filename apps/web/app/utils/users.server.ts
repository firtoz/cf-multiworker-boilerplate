import { eq } from "drizzle-orm";
import type { AppLoadContext } from "react-router";
import { v7 as uuidv7 } from "uuid";
import { getDb } from "../../db/db.server";
import * as schema from "../../db/schema";

/**
 * Get a user by ID
 */
export async function getUserById(context: AppLoadContext, id: string) {
	const db = getDb(context);
	return db.query.usersTable.findFirst({
		where: eq(schema.usersTable.id, id),
	});
}

/**
 * Create a new user
 */
export async function createUser(context: AppLoadContext, email?: string) {
	const db = getDb(context);
	const result = await db
		.insert(schema.usersTable)
		.values({
			id: uuidv7(),
			email: email || `user-${uuidv7().substring(0, 8)}@example.com`,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning();
	return result[0];
}

/**
 * Get a user by ID or create a new one if not found
 */
export async function getUserOrCreate(context: AppLoadContext, id?: string) {
	if (id) {
		const existingUser = await getUserById(context, id);
		if (existingUser) {
			// Update last access time
			const db = getDb(context);
			await db
				.update(schema.usersTable)
				.set({ updatedAt: new Date() })
				.where(eq(schema.usersTable.id, id));
			return existingUser;
		}
	}

	// Create a new user if ID is not provided or user doesn't exist
	return createUser(context);
}
