# Web App

React Router 7 application deployed on Cloudflare Workers.

## Dependencies

**Durable Objects Used:**
- `example-do` - Example counter (used in home route)
- `coordinator-do` - Queue orchestrator (used in queue route)

**Packages:**
- `do-common` - Shared types for DO communication

**How bindings work:** Check `wrangler.jsonc` → `durable_objects.bindings` to see which DOs are available as `env.DoName`.

## Key Files

- `app/routes/` - Route components (home.tsx, queue.tsx)
- `app/root.tsx` - Root layout with dark mode support
- `app/entry.server.tsx` - SSR entry + 103 Early Hints for CSS
- `workers/app.ts` - Cloudflare Worker wrapper for React Router
- `wrangler.jsonc` - **IMPORTANT**: All DO bindings, queues, env vars

## Common Tasks

### 1. Add a New Route That Calls a DO

```tsx
// app/routes/my-feature.tsx
import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import type { Route } from "./+types/my-feature";

export async function loader() {
  // Type-safe DO call
  const api = honoDoFetcherWithName(env.CoordinatorDo, "main-coordinator");
  const response = await api.get({ url: "/queue" });
  const data = await response.json();
  
  return { items: data.queue };
}

export default function MyFeature({ loaderData }: Route.ComponentProps) {
  return <div>{loaderData.items.length} items</div>;
}
```

Route is auto-available at `/my-feature`.

### 2. Add a Form That Submits to a DO

```tsx
import { formAction, success, fail } from "@firtoz/router-toolkit";
import { z } from "zod";
import { zfd } from "zod-form-data";

// Define form schema
const schema = zfd.formData({
  name: zfd.text(z.string().min(1)),
  count: zfd.numeric(z.number().min(1).max(100)),
});

// Handle form submission
export const action = formAction({
  schema,
  handler: async (_args, data) => {
    const api = honoDoFetcherWithName(env.CoordinatorDo, "main");
    
    try {
      const response = await api.post({
        url: "/submit",
        body: data,
      });
      return success(await response.json());
    } catch (error) {
      return fail("Submission failed");
    }
  },
});
```

### 3. Add a New DO Binding

**Step 1:** Add binding to `wrangler.jsonc`:
```jsonc
"durable_objects": {
  "bindings": [
    // ... existing bindings ...
    {
      "name": "MyNewDo",           // Name in env.MyNewDo
      "class_name": "MyNewDo",      // Class name from DO worker
      "script_name": "cf-my-new-do" // Worker name from DO's wrangler.jsonc
    }
  ]
}
```

**Step 2:** Generate types (from project root):
```bash
bun run typegen
```

**Step 3:** Use in routes:
```tsx
import { env } from "cloudflare:workers";

const stub = env.MyNewDo.getByName("instance-id");
const response = await stub.fetch("https://fake-host/endpoint");
```

### 4. Rename the Project

1. Update `wrangler.jsonc` → `name` field
2. Update DO bindings to match new DO script names
3. Update `package.json` → `name` field
4. Run `bun run typegen` from root

### 5. Add Environment Variables

**Development:** Add to `.env`:
```bash
MY_SECRET=dev-value
```

**Production:** Add to `wrangler.jsonc`:
```jsonc
"vars": {
  "MY_PUBLIC_VAR": "public-value"
}
```

Or use secrets:
```bash
bunx wrangler secret put MY_SECRET
```

Access in code:
```tsx
import { env } from "cloudflare:workers";
console.log(env.MY_SECRET);
```

## Development

```bash
bun run dev
```

Starts dev server at http://localhost:5173

## Type Generation

After changing `wrangler.jsonc` or route files, run from project root:

```bash
bun run typegen
```

This:
1. Runs `wrangler types` to generate `worker-configuration.d.ts` (Cloudflare bindings)
2. Runs `post-typegen.ts` to convert DO comments to proper imports
3. Runs `react-router typegen` to generate route types
4. Gives you full IntelliSense for `env.DoName` and route loaders/actions

Or run locally in this directory:
```bash
bun run typegen  # Runs both cf-typegen and rr-typegen
bun run cf-typegen  # Just Cloudflare types
bun run rr-typegen  # Just React Router types
```

## Deploy

```bash
bun run deploy
```

Deploys to Cloudflare Workers.
