/**
 * Common types and utilities shared across Durable Objects
 */
import { z } from "zod";

/**
 * Schema for work payload sent to the queue
 * This is the strict schema - no coercion
 */
export const workPayloadSchema = z.object({
	message: z.string().min(1, "Message is required"),
	delay: z.number().min(100).max(5000),
});

/**
 * Schema for work result sent back to coordinator
 */
export const workResultSchema = z.object({
	result: z.unknown().optional(),
	error: z.string().optional(),
});

/**
 * Inferred TypeScript types from the schemas
 */
export type WorkPayload = z.infer<typeof workPayloadSchema>;
export type WorkResult = z.infer<typeof workResultSchema>;

export type QueueMessage = {
	workId: string;
	payload: WorkPayload;
	coordinatorId: string;
};
