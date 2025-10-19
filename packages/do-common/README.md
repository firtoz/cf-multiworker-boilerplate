# DO Common

Shared types and Zod schemas used across Durable Objects.

## Dependencies

**Uses:** Only `zod`

**Used By:**
- `apps/web` - Validates form data before sending to DOs
- `coordinator-do` - Validates incoming requests and queue messages
- `processor-do` - Validates work payloads

## What's This?

Single source of truth for:
- Types shared between multiple workers/DOs
- Zod schemas for validation
- Message formats for queues
- Common interfaces

## Current Exports

```typescript
// Types
export type WorkPayload = {
  message: string;
  delay: number;
  timestamps: TimestampEntry[];
};

export type ProcessorResult = {
  processed: boolean;
  message: string;
  timestamps: TimestampEntry[];
};

export type QueueMessage = {
  workId: string;
  payload: WorkPayload;
  coordinatorId: string;
  timestamps: TimestampEntry[];
};

export type TimestampEntry = {
  tag: string;
  time: number;
};

// Zod Schemas
export const workPayloadSchema: z.ZodSchema<WorkPayload>;
export const workResultSchema: z.ZodSchema<WorkResult>;
```

## Common Tasks

### 1. Add a New Shared Type

When multiple DOs need the same type:

```typescript
// index.ts
export const notificationSchema = z.object({
  userId: z.string(),
  message: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  createdAt: z.number(),
});

export type Notification = z.infer<typeof notificationSchema>;
```

Use in DOs:
```typescript
import { notificationSchema, type Notification } from "do-common";

// Validate
const notification = notificationSchema.parse(input);

// Type-safe function
async function sendNotification(notif: Notification) {
  // TypeScript knows all fields
}
```

### 2. Extend Existing Types

Add optional fields without breaking existing code:

```typescript
// Before
export const workPayloadSchema = z.object({
  message: z.string(),
  delay: z.number(),
  timestamps: z.array(timestampEntrySchema),
});

// After - add optional field
export const workPayloadSchema = z.object({
  message: z.string(),
  delay: z.number(),
  timestamps: z.array(timestampEntrySchema),
  priority: z.number().optional(),  // NEW - optional so existing code still works
});
```

### 3. Add Validation Helpers

```typescript
// Common validation functions
export function isValidEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const uuidSchema = z.string().uuid();

// Use in DOs
import { emailSchema } from "do-common";

const userSchema = z.object({
  email: emailSchema,
  name: z.string(),
});
```

### 4. Version Your Schemas

When making breaking changes:

```typescript
// Keep old version for migration
export const workPayloadSchemaV1 = z.object({
  message: z.string(),
  delay: z.number(),
});

// New version with breaking changes
export const workPayloadSchemaV2 = z.object({
  message: z.string(),
  delay: z.number(),
  timestamps: z.array(timestampEntrySchema),  // Now required
});

// Export latest as default
export const workPayloadSchema = workPayloadSchemaV2;

// Export types
export type WorkPayloadV1 = z.infer<typeof workPayloadSchemaV1>;
export type WorkPayloadV2 = z.infer<typeof workPayloadSchemaV2>;
export type WorkPayload = WorkPayloadV2;

// Migration helper
export function migrateWorkPayload(v1: WorkPayloadV1): WorkPayloadV2 {
  return {
    ...v1,
    timestamps: [],
  };
}
```

### 5. Add Enums and Constants

```typescript
// Shared enums
export const WorkStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type WorkStatus = typeof WorkStatus[keyof typeof WorkStatus];

// Or with Zod
export const workStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);
export type WorkStatus = z.infer<typeof workStatusSchema>;

// Shared constants
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_DELAY_MS = 5000;
export const MAX_BATCH_SIZE = 100;
```

Use in validation:
```typescript
import { MAX_MESSAGE_LENGTH, MAX_DELAY_MS } from "do-common";

const schema = z.object({
  message: z.string().max(MAX_MESSAGE_LENGTH),
  delay: z.number().max(MAX_DELAY_MS),
});
```

## When to Add Types Here

**DO add to `do-common`:**
- ✅ Types used by 2+ workers/DOs
- ✅ Queue message formats
- ✅ Shared validation schemas
- ✅ Common enums/constants
- ✅ API request/response types

**DON'T add to `do-common`:**
- ❌ Types used by only one DO
- ❌ Internal implementation details
- ❌ UI-specific types (keep in web app)
- ❌ DO storage schemas (unless shared)

## Usage Examples

### In Web App
```typescript
import { workPayloadSchema } from "do-common";
import { zfd } from "zod-form-data";

// Validate form data
export const formSchema = zfd.formData({
  message: zfd.text(z.string().min(1)),
  delay: zfd.numeric(z.number().min(0).max(5000)),
});

export const action = formAction({
  schema: formSchema,
  handler: async (_, data) => {
    // Send validated data to DO
  },
});
```

### In Coordinator DO
```typescript
import { workPayloadSchema, type WorkPayload } from "do-common";
import { zValidator } from "@hono/zod-validator";

app.post("/queue", zValidator("json", workPayloadSchema), async (c) => {
  const payload = c.req.valid("json");  // Fully typed!
  // Process payload
});
```

### In Processor DO
```typescript
import { workPayloadSchema, type ProcessorResult } from "do-common";

async processWork(payload: WorkPayload): Promise<ProcessorResult> {
  // Validate just in case
  const validated = workPayloadSchema.parse(payload);
  
  // Process and return typed result
  return {
    processed: true,
    message: `Processed: ${validated.message}`,
    timestamps: validated.timestamps,
  };
}
```

## Why This Exists

Without shared types:
```typescript
// coordinator-do/workers/app.ts
type WorkPayload = { message: string; delay: number };

// processor-do/workers/app.ts
type WorkPayload = { msg: string; delay: number };  // Typo! Runtime error!
```

With `do-common`:
```typescript
// Both import same type
import { type WorkPayload } from "do-common";

// TypeScript enforces compatibility
// Runtime validation ensures correctness
```

