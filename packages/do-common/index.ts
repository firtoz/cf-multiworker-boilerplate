/**
 * Common types and utilities shared across Durable Objects
 */
import { z } from "zod";

/**
 * High-precision timestamp entry with sequential tag
 */
export type TimestampEntry = {
	tag: string;
	time: number;
};

/**
 * Schema for work payload sent to the queue
 * This is the strict schema - no coercion
 */
export const workPayloadSchema = z.object({
	message: z.string().min(1, "Message is required"),
	delay: z.number().min(0).max(5000),
	timestamps: z
		.array(
			z.object({
				tag: z.string(),
				time: z.number(),
			}),
		)
		.optional(),
});

/**
 * Schema for processor result
 */
export const processorResultSchema = z.object({
	processed: z.boolean(),
	input: workPayloadSchema,
	processedAt: z.number(),
	processCount: z.number(),
	message: z.string(),
	timestamps: z.array(
		z.object({
			tag: z.string(),
			time: z.number(),
		}),
	),
});

/**
 * Schema for work result sent back to coordinator
 */
export const workResultSchema = z.object({
	result: processorResultSchema.optional(),
	error: z.string().optional(),
	timestamps: z
		.array(
			z.object({
				tag: z.string(),
				time: z.number(),
			}),
		)
		.optional(),
});

/**
 * Inferred TypeScript types from the schemas
 */
export type WorkPayload = z.infer<typeof workPayloadSchema>;
export type WorkResult = z.infer<typeof workResultSchema>;
export type ProcessorResult = z.infer<typeof processorResultSchema>;

export type QueueMessage = {
	workId: string;
	payload: WorkPayload;
	coordinatorId: string;
	timestamps: TimestampEntry[];
};
