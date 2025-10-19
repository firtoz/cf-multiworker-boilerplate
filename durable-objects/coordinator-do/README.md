# Coordinator Durable Object

Orchestrates work distribution and manages queue state.

## Dependencies

**Uses:**
- `processor-do` - Delegates work processing (via queue or direct RPC)
- `do-common` - Shared types (`WorkPayload`, `QueueMessage`, etc.)

**Used By:**
- `apps/web` - Web app calls coordinator to submit/query work

**Bindings in `wrangler.jsonc`:**
- `ProcessorDo` - Durable Object binding for direct calls
- `WORK_QUEUE` - Cloudflare Queue binding for queue mode

## Key Files

- `workers/app.ts` - Main DO class with Hono app
- `wrangler.jsonc` - **IMPORTANT**: Contains DO/queue bindings

## API Routes

```typescript
GET  /                    // Health check
GET  /queue              // Get all work items
POST /queue              // Submit single work item
POST /queue/batch        // Submit multiple work items
POST /result/:workId     // Receive result from ProcessorDo
```

## Common Tasks

### 1. Rename This DO

**Step 1:** Rename the folder:
```bash
mv coordinator-do my-orchestrator-do
```

**Step 2:** Update `wrangler.jsonc` in this folder:
```jsonc
{
  "name": "cf-my-orchestrator-do",  // Change this
  "main": "workers/app.ts",
  "durable_objects": {
    "bindings": [
      {
        "name": "MyOrchestratorDo",        // Change this
        "class_name": "MyOrchestratorDo",  // Change this
        "script_name": "cf-my-orchestrator-do"
      }
    ]
  }
}
```

**Step 3:** Update class name in `workers/app.ts`:
```typescript
export class MyOrchestratorDo extends DurableObject<Env> {
  // ...
}
```

**Step 4:** Update `package.json` → `name` field

**Step 5:** Update bindings in web app's `wrangler.jsonc`:
```jsonc
{
  "name": "MyOrchestratorDo",
  "class_name": "MyOrchestratorDo",
  "script_name": "cf-my-orchestrator-do"
}
```

**Step 6:** Regenerate types (from project root):
```bash
bun run typegen
```

### 2. Add a New Route

```typescript
// In workers/app.ts, chain onto existing app
app = new Hono<{ Bindings: Env }>()
  // ... existing routes ...
  .get("/stats", async (c) => {
    const queue = await this.ctx.storage.get<WorkItem[]>("queue") || [];
    const pending = queue.filter(i => i.status === "pending").length;
    const completed = queue.filter(i => i.status === "completed").length;
    
    return c.json({ pending, completed, total: queue.length });
  })
  .post("/clear", async (c) => {
    await this.ctx.storage.put("queue", []);
    return c.json({ success: true });
  });
```

Call from web app:
```typescript
const api = honoDoFetcherWithName(env.CoordinatorDo, "main");
const stats = await api.get({ url: "/stats" });
```

### 3. Change Storage Schema

When you modify `WorkItem` structure:

**Step 1:** Update the type:
```typescript
type WorkItem = {
  id: string;
  payload: WorkPayload;
  status: "pending" | "processing" | "completed" | "failed";
  priority?: number;  // NEW FIELD
  // ... other fields
};
```

**Step 2:** Bump version to trigger auto-migration:
```typescript
const COORDINATOR_VERSION = 2;  // Was 1
```

**Result:** On next request, `checkAndMigrateVersion()` will clear storage and start fresh.

**For complex migrations:** Modify `checkAndMigrateVersion()` to migrate data:
```typescript
private async checkAndMigrateVersion() {
  const storedVersion = await this.ctx.storage.get<number>("version");
  
  if (storedVersion === 1) {
    // Migrate from v1 to v2
    const oldQueue = await this.ctx.storage.get<OldWorkItem[]>("queue") || [];
    const newQueue = oldQueue.map(item => ({
      ...item,
      priority: 0,  // Add default priority
    }));
    await this.ctx.storage.put("queue", newQueue);
    await this.ctx.storage.put("version", 2);
  }
}
```

### 4. Add Another DO Dependency

To call a new DO from coordinator:

**Step 1:** Add binding to `wrangler.jsonc`:
```jsonc
"durable_objects": {
  "bindings": [
    {
      "name": "ProcessorDo",
      "class_name": "ProcessorDo",
      "script_name": "cf-processor-do"
    },
    {
      "name": "NotifierDo",
      "class_name": "NotifierDo",
      "script_name": "cf-notifier-do"
    }
  ]
}
```

**Step 2:** Generate types (from project root):
```bash
bun run typegen
```

**Step 3:** Use in code:
```typescript
private async notifyCompletion(workId: string) {
  const notifier = this.env.NotifierDo.getByName("notifications");
  await notifier.fetch("https://fake-host/notify", {
    method: "POST",
    body: JSON.stringify({ workId }),
  });
}
```

### 5. Switch from Queue to Pure RPC

Remove Cloudflare Queue entirely:

**Step 1:** Remove from `wrangler.jsonc`:
```jsonc
// DELETE the queues section
```

**Step 2:** Remove queue mode from code:
```typescript
private async processWork(workId: string) {
  // Remove queue mode logic, keep only direct mode
  const stub = this.env.ProcessorDo.getByName(`processor-${workId}`);
  const result = await stub.processWork(workItem.payload);
  await this.updateWorkResult(workItem.id, result, undefined, result?.timestamps);
}
```

## Storage Schema

```typescript
{
  version: number,       // Schema version (bumping this triggers migration)
  queue: WorkItem[]     // Array of work items (kept at max 50)
}
```

## Communication Patterns

### Queue Mode (reliable, scalable)
```
Web → CoordinatorDo → Cloudflare Queue → ProcessorDo → CoordinatorDo
```

### Direct Mode (faster, less overhead)
```
Web → CoordinatorDo → ProcessorDo.processWork() → CoordinatorDo
```

## Usage from Web App

```typescript
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { env } from "cloudflare:workers";

const api = honoDoFetcherWithName(env.CoordinatorDo, "main-coordinator");

// Submit work
await api.post({
  url: "/queue",
  body: { message: "Process this", delay: 1000, mode: "queue" }
});

// Get queue status
const { queue } = await api.get({ url: "/queue" }).then(r => r.json());
```

