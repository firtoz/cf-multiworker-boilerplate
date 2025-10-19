# Example Durable Object

Minimal Durable Object demonstrating basic structure.

## Dependencies

**Uses:** None - standalone example

**Used By:**
- `apps/web` - Home route demos the counter

## Key Files

- `workers/app.ts` - DO class with Hono routes
- `wrangler.jsonc` - Worker config

## API Routes

```typescript
GET  /            // Health check
GET  /count       // Get current count
POST /increment   // Increment count
```

## Common Tasks

### 1. Use This as a Template

This is the simplest DO - copy it as a starting point:

```bash
# Copy the folder
cp -r durable-objects/example-do durable-objects/my-feature-do

# Update files (see "Rename This DO" below)
```

### 2. Rename This DO

**Step 1:** Update `wrangler.jsonc`:
```jsonc
{
  "name": "cf-my-feature-do",  // Change worker name
  "durable_objects": {
    "bindings": [
      {
        "name": "MyFeatureDo",
        "class_name": "MyFeatureDo",
        "script_name": "cf-my-feature-do"
      }
    ]
  }
}
```

**Step 2:** Update class in `workers/app.ts`:
```typescript
export class MyFeatureDo extends DurableObject<Env> implements DOWithHonoApp {
  // ... your code
}
```

**Step 3:** Update `package.json` → `name`: `"my-feature-do"`

**Step 4:** Add binding to web app's `wrangler.jsonc`:
```jsonc
"durable_objects": {
  "bindings": [
    {
      "name": "MyFeatureDo",
      "class_name": "MyFeatureDo",
      "script_name": "cf-my-feature-do"
    }
  ]
}
```

**Step 5:** Regenerate types (from project root):
```bash
bun run typegen
```

### 3. Add More Routes

```typescript
app = new Hono<{ Bindings: Env }>()
  .get("/", (c) => c.json({ status: "ExampleDo ready" }))
  .get("/count", async (c) => {
    const count = await this.ctx.storage.get<number>("count") || 0;
    return c.json({ count });
  })
  .post("/increment", async (c) => {
    const count = await this.ctx.storage.get<number>("count") || 0;
    await this.ctx.storage.put("count", count + 1);
    return c.json({ count: count + 1 });
  })
  // NEW ROUTES:
  .post("/decrement", async (c) => {
    const count = await this.ctx.storage.get<number>("count") || 0;
    const newCount = Math.max(0, count - 1);
    await this.ctx.storage.put("count", newCount);
    return c.json({ count: newCount });
  })
  .delete("/reset", async (c) => {
    await this.ctx.storage.put("count", 0);
    return c.json({ count: 0 });
  });
```

### 4. Add Request Validation

```typescript
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const incrementSchema = z.object({
  amount: z.number().min(1).max(100),
});

app = new Hono<{ Bindings: Env }>()
  .post("/increment", zValidator("json", incrementSchema), async (c) => {
    const { amount } = c.req.valid("json");
    
    const count = await this.ctx.storage.get<number>("count") || 0;
    const newCount = count + amount;
    await this.ctx.storage.put("count", newCount);
    
    return c.json({ count: newCount });
  });
```

### 5. Store Complex Data

```typescript
type UserData = {
  id: string;
  name: string;
  createdAt: number;
};

app = new Hono<{ Bindings: Env }>()
  .post("/user", async (c) => {
    const body = await c.req.json();
    const userData: UserData = {
      id: crypto.randomUUID(),
      name: body.name,
      createdAt: Date.now(),
    };
    
    // Store individual user
    await this.ctx.storage.put(`user:${userData.id}`, userData);
    
    // Update user list
    const users = await this.ctx.storage.get<string[]>("userIds") || [];
    users.push(userData.id);
    await this.ctx.storage.put("userIds", users);
    
    return c.json(userData);
  })
  .get("/users", async (c) => {
    const userIds = await this.ctx.storage.get<string[]>("userIds") || [];
    const users = await Promise.all(
      userIds.map(id => this.ctx.storage.get<UserData>(`user:${id}`))
    );
    return c.json({ users: users.filter(Boolean) });
  });
```

### 6. Add Shared Types

If multiple DOs use the same types, add them to `do-common`:

```typescript
// packages/do-common/index.ts
export const userDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
});

export type UserData = z.infer<typeof userDataSchema>;
```

Then import:
```typescript
import { type UserData, userDataSchema } from "do-common";
```

## Storage Operations

```typescript
// Get single value
const value = await this.ctx.storage.get<T>("key");

// Get multiple values
const map = await this.ctx.storage.get(["key1", "key2"]);

// Set value
await this.ctx.storage.put("key", value);

// Set multiple values
await this.ctx.storage.put({ key1: value1, key2: value2 });

// Delete
await this.ctx.storage.delete("key");

// List keys with prefix
const keys = await this.ctx.storage.list({ prefix: "user:" });

// Delete all
await this.ctx.storage.deleteAll();
```

## Usage from Web App

```typescript
import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";

// Type-safe calls with hono-fetcher
const api = honoDoFetcherWithName(env.ExampleDo, "my-counter");
const { count } = await api.get({ url: "/count" }).then(r => r.json());
await api.post({ url: "/increment" });

// Or raw fetch
const stub = env.ExampleDo.getByName("my-counter");
const response = await stub.fetch("https://fake-host/count");
```

## Creating New DOs

Use the Turborepo generator:

```bash
bunx turbo gen durable-object
```

This creates a new DO with the same structure as this example.

