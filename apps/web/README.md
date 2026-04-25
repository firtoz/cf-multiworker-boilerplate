# Web App

React Router 7 application deployed on Cloudflare Workers.

## Dependencies

**Durable Objects / services:** `chatroom-do` (WebSockets / Socka; `/chat` and `/api/ws/*` in `workers/app.ts`), `ping-do` (typed Hono DO example), and `other-worker` (service binding example).

**Packages:** `cf-starter-db` (D1 + Drizzle for `/visitors`), `cf-starter-chat-contract` (shared Socka types).

**How bindings work:** **`apps/web/alchemy.run.ts`** declares app bindings and imports worker/DO resources from dependency packages' `./alchemy` exports. Types: **`env.d.ts`** (`typeof web["Env"]`). After route edits, **`bun run typegen`** from the repo root.

## Key Files

- `app/routes/` - Route components (home, visitors, chat, …)
- `app/root.tsx` - Root layout with dark mode support
- `app/entry.server.tsx` - SSR entry + 103 Early Hints for CSS
- `workers/app.ts` - Cloudflare Worker (SSR + WebSocket forward to `ChatroomDo`)
- `alchemy.run.ts` - Web Alchemy app, D1 binding, and imported worker/DO bindings
- `env.d.ts` - Cloudflare `env` types from the exported `web` resource

## Common Tasks

### 1. Add a New Route That Calls a DO

```tsx
// app/routes/my-feature.tsx
import { env } from "cloudflare:workers";
import { incrementSiteVisits } from "cf-starter-db";
import type { Route } from "./+types/my-feature";

export async function loader() {
  const count = await incrementSiteVisits(env.DB);
  return { count };
}

export default function MyFeature({ loaderData }: Route.ComponentProps) {
  return <div>Visits: {loaderData.count}</div>;
}
```

Route is auto-available at `/my-feature`.

### 2. Add a Form That Submits to a DO

```tsx
import { fail, success } from "@firtoz/maybe-error";
import { formAction } from "@firtoz/router-toolkit";
import { z } from "zod";
import { zfd } from "zod-form-data";

// Define form schema
const schema = zfd.formData({
  name: zfd.text(z.string().min(1)),
  count: zfd.numeric(z.number().min(1).max(100)),
});

// Handle form submission (use a non-index route for POST+formAction — see /visitors)
export const action = formAction({
  schema,
  handler: async (_args, data) => {
    void data;
    return success({ ok: true });
  },
});
```

### 3. Consume a Generated DO

**Step 1:** Add the provider package as a web dependency if Turbo should check it first:

```json
"my-new-do": "workspace:*"
```

**Step 2:** Export the provider resource from that package's `alchemy.run.ts`, then import it in `apps/web/alchemy.run.ts`:

```ts
import { MyNewDo } from "my-new-do/alchemy";
```

**Step 3:** Refresh route types (from project root):

```bash
bun run typegen
```

**Step 4:** Use in routes:

```tsx
import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";

using api = honoDoFetcherWithName(env.PingDo, "demo");
const response = await api.get({ url: "/ping" });
```

### 4. Rename the Project

1. Update package names and user-facing copy.
2. Choose stable worker names in each package’s `alchemy.run.ts` when another worker refers to it by service binding.
3. Update `package.json` → `name` field.
4. Run `bun run typegen` from root.

### 5. Add Environment Variables

**Development:** Run root **`bun run setup`** once (creates **`.env.local`** with **`SESSION_SECRET`** and **`ALCHEMY_PASSWORD`** if missing), or add to repo-root **`.env.local`** (or optional per-package **`.env.local`**), not a plain **`.env`** — see [.cursor/skills/cf-workers-env-local/SKILL.md](../../.cursor/skills/cf-workers-env-local/SKILL.md) and root **[AGENTS.md](../../AGENTS.md)** (index):
```bash
MY_SECRET=dev-value
```

**Production:** Add to repo-root **`.env.production`** or your CI secret store. Wire the value in the relevant package `alchemy.run.ts` using `alchemy.secret(...)` when needed.

Access in code:
```tsx
import { env } from "cloudflare:workers";
console.log(env.MY_SECRET);
```

## Development

```bash
bun run dev
```

Vite prints the local URL in the terminal (`Local:` — default port 5173, or the next free if it’s taken).

## Type Generation

After changing package **`alchemy.run.ts`**, **`env.d.ts`**, or route files, run from the **repo root**:

```bash
bun run typegen
```

This runs **`react-router typegen`** (via Turbo) for route types. Cloudflare **`env`** types come from **`env.d.ts`** + package-local Alchemy resources ([Alchemy type-safe bindings](https://alchemy.run/concepts/bindings/#type-safe-bindings)); there is no `wrangler types` step in this stack.

In this package only:

```bash
bun run rr-typegen  # React Router typegen
```

## Deploy

From the **repo root**:

```bash
bun run deploy
```

This runs the Turbo deploy graph; each deployable package runs **`alchemy deploy --app <package-id>`**. See [.cursor/skills/cf-starter-workflow/SKILL.md](../../.cursor/skills/cf-starter-workflow/SKILL.md), root **`AGENTS.md`**, and root **`README.md`**.
