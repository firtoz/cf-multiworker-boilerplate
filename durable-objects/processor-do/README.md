# Processor Durable Object

Processes work items sent from CoordinatorDo.

## Dependencies

**Uses:**
- `coordinator-do` - Reports results back via HTTP POST to `/result/:workId`
- `do-common` - Shared types (`WorkPayload`, `ProcessorResult`, `QueueMessage`)

**Used By:**
- `coordinator-do` - Sends work via queue or direct RPC

**Bindings in `wrangler.jsonc`:**
- `CoordinatorDo` - To report results back
- `WORK_QUEUE` - Queue consumer binding

## Key Files

- `workers/app.ts` - DO class with `queue()` consumer and `processWork()` method
- `wrangler.jsonc` - **IMPORTANT**: Queue consumer binding configuration

## Two Ways to Receive Work

### 1. Queue Consumer (reliable, scalable)
Triggered automatically when messages arrive:
```typescript
async queue(batch: MessageBatch<QueueMessage>) {
  for (const message of batch.messages) {
    await this.processWork(message.body.payload);
    message.ack();
  }
}
```

### 2. Direct RPC (faster, less overhead)
Called directly from CoordinatorDo:
```typescript
async processWork(payload: WorkPayload): Promise<ProcessorResult> {
  // Process and return result
}
```

## Common Tasks

### 1. Change the Processing Logic

The actual work happens in `processWork()`:

```typescript
async processWork(payload: WorkPayload): Promise<ProcessorResult> {
  timestamps.push({ tag: "processorReceived", time: Date.now() });
  
  // REPLACE THIS with your actual processing:
  // - Call external APIs
  // - Run computations
  // - Transform data
  // - Generate reports
  // - etc.
  
  if (payload.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, payload.delay));
  }
  
  // Your custom result
  const result = {
    processed: true,
    data: yourProcessedData,
    timestamps,
  };
  
  timestamps.push({ tag: "processingComplete", time: Date.now() });
  
  return result;
}
```

### 2. Add Persistent State

ProcessorDo is stateless by default. To add storage:

```typescript
async processWork(payload: WorkPayload): Promise<ProcessorResult> {
  // Track processing count per instance
  const count = await this.ctx.storage.get<number>("processedCount") || 0;
  await this.ctx.storage.put("processedCount", count + 1);
  
  // Store processing history
  const history = await this.ctx.storage.get<string[]>("history") || [];
  history.push(payload.message);
  await this.ctx.storage.put("history", history.slice(-100)); // Keep last 100
  
  // Your processing logic
  const result = await yourProcessing(payload);
  
  return result;
}
```

### 3. Handle Errors with Retries

Queue messages retry automatically on failure:

```typescript
async queue(batch: MessageBatch<QueueMessage>) {
  for (const message of batch.messages) {
    try {
      await this.processWork(message.body.payload);
      message.ack();  // Success - remove from queue
    } catch (error) {
      console.error("Processing failed:", error);
      message.retry();  // Requeue for retry
      // Or message.ack() to discard failed message
    }
  }
}
```

Configure retries in `wrangler.jsonc`:
```jsonc
"queues": {
  "consumers": [
    {
      "queue": "work-queue",
      "max_batch_size": 10,
      "max_retries": 3,        // Retry up to 3 times
      "dead_letter_queue": "failed-work-queue"  // Send failures here
    }
  ]
}
```

### 4. Process Multiple Messages in Batch

Optimize by processing messages together:

```typescript
async queue(batch: MessageBatch<QueueMessage>) {
  // Extract all payloads
  const payloads = batch.messages.map(m => m.body.payload);
  
  // Process as batch (more efficient for DB operations, API calls, etc.)
  const results = await yourBatchProcessing(payloads);
  
  // Report results and ack messages
  for (let i = 0; i < batch.messages.length; i++) {
    await this.reportResult(
      batch.messages[i].body.workId,
      batch.messages[i].body.coordinatorId,
      results[i]
    );
    batch.messages[i].ack();
  }
}
```

### 5. Add Validation

Validate incoming work using Zod schemas from `do-common`:

```typescript
import { workPayloadSchema } from "do-common";

async processWork(payload: WorkPayload): Promise<ProcessorResult> {
  // Validate payload structure
  const validated = workPayloadSchema.parse(payload);
  
  // Add custom business logic validation
  if (validated.delay > 5000) {
    throw new Error("Delay too long");
  }
  
  // Process validated payload
  return await yourProcessing(validated);
}
```

### 6. Call External APIs

```typescript
async processWork(payload: WorkPayload): Promise<ProcessorResult> {
  // Call external service
  const response = await fetch("https://api.example.com/process", {
    method: "POST",
    headers: { "Authorization": `Bearer ${this.env.API_TOKEN}` },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`API failed: ${response.statusText}`);
  }
  
  const apiResult = await response.json();
  
  return {
    processed: true,
    apiResult,
    timestamps: payload.timestamps,
  };
}
```

### 7. Rename This DO

Follow same steps as coordinator-do - update folder name, `wrangler.jsonc`, class name, and regenerate types in dependent workers.

## Processing Flow

```
1. Receive work (queue or RPC)
2. Add "processorReceived" timestamp
3. YOUR PROCESSING LOGIC HERE
4. Add "processingComplete" timestamp
5. Report result to CoordinatorDo
6. Acknowledge queue message (if from queue)
```

## Storage

Stateless by default - each work item can get its own processor instance.

To add state, use `this.ctx.storage`:
```typescript
await this.ctx.storage.get<T>("key");
await this.ctx.storage.put("key", value);
await this.ctx.storage.delete("key");
```

## Usage from CoordinatorDo

### Queue Mode
```typescript
await this.env.WORK_QUEUE.send({
  workId: workItem.id,
  payload: workItem.payload,
  coordinatorId: this.ctx.id.toString(),
  timestamps: workItem.timestamps,
});
```

### Direct Mode
```typescript
const stub = this.env.ProcessorDo.getByName(`processor-${workId}`);
const result = await stub.processWork(workItem.payload);
```

