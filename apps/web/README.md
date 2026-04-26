# Web app

React Router 7 application deployed on Cloudflare Workers.

**Docs map:** [README.md](../../README.md) (monorepo quick start + building a product) · this file (web app only) · [AGENTS.md](../../AGENTS.md) (index to rules/skills) · [CONTRIBUTING.md](../../CONTRIBUTING.md) (contribution/PRs).

**Skills** under [.cursor/skills/](../../.cursor/skills/) are project-specific playbooks, not marketing docs.

## Dependencies

**Durable Objects / services:** `chatroom-do` (WebSockets / Socka; `/chat` and `/api/ws/*` in `workers/app.ts`), `ping-do` (typed Hono DO example), and `other-worker` (service binding example).

**Packages:** `cf-starter-db` (D1 + Drizzle for `/visitors`), `cf-starter-chat-contract` (shared Socka types).

**How bindings work:** **`apps/web/alchemy.run.ts`** declares app bindings and imports worker/DO resources from dependency packages' `./alchemy` exports. Types: **`env.d.ts`** (`typeof web["Env"]`). After route edits, **`bun run typegen`** from the repo root.

## Key files

- `app/routes/` - Route components (home, visitors, chat, …)
- `app/root.tsx` - Root layout with dark mode support
- `app/entry.server.tsx` - SSR entry + 103 Early Hints for CSS
- `workers/app.ts` - Cloudflare Worker (SSR + WebSocket forward to `ChatroomDo`)
- `alchemy.run.ts` - Web Alchemy app, D1 binding, and imported worker/DO bindings
- `env.d.ts` - Cloudflare `env` types from the exported `web` resource

## Common tasks

### 1. Add a route (register it, then implement)

File-based route modules are listed explicitly in `app/routes.ts`. A new `app/routes/foo.tsx` does nothing until you add it there.

1. In **`app/routes.ts`**, add a line such as: `route("my-feature", "routes/my-feature.tsx")` (path segment → file under `app/routes/`).
2. Create **`app/routes/my-feature.tsx`**. After edits, run **`bun run typegen`** from the repo root so `./+types/my-feature` exists.
3. Export **`RoutePath`** and use **`Promise<MaybeError<...>>`** in loaders, matching the rest of this app:

```tsx
// app/routes.ts — register the route
// route("my-feature", "routes/my-feature.tsx"),

// app/routes/my-feature.tsx
import { env } from "cloudflare:workers";
import { type MaybeError, success } from "@firtoz/maybe-error";
import type { RoutePath } from "@firtoz/router-toolkit";
import { incrementSiteVisits } from "cf-starter-db";
import type { Route } from "./+types/my-feature";

export const route: RoutePath<"/my-feature"> = "/my-feature";

export async function loader(
	_args: Route.LoaderArgs,
): Promise<MaybeError<{ count: number }>> {
	const count = await incrementSiteVisits(env.DB);
	return success({ count });
}

export default function MyFeature({ loaderData }: Route.ComponentProps) {
	if (!loaderData.success) {
		return <p>{loaderData.error}</p>;
	}
	return <div>Visits: {loaderData.result.count}</div>;
}
```

See [.cursor/skills/routing/SKILL.md](../../.cursor/skills/routing/SKILL.md).

### 2. Add a form (and POST to a non-index route)

Use `formAction` from `@firtoz/router-toolkit` and return `success(...)` / `fail(...)` from `@firtoz/maybe-error`. Keep POST actions on a non-index route unless you intentionally handle React Router’s `/?index` behavior. See [.cursor/skills/form-submissions/SKILL.md](../../.cursor/skills/form-submissions/SKILL.md).

### 3. Wire a new DO or worker into the web app

Do not duplicate the monorepo checklist here. After **`bunx turbo gen durable-object`** (or copying an existing `durable-objects/*` package), follow the root [README.md](../../README.md) section **After `turbo gen durable-object`**, then:

- [.cursor/skills/cf-durable-object-package/SKILL.md](../../.cursor/skills/cf-durable-object-package/SKILL.md) — package layout and `alchemy.run.ts`
- [.cursor/skills/cf-web-alchemy-bindings/SKILL.md](../../.cursor/skills/cf-web-alchemy-bindings/SKILL.md) — `apps/web/package.json` workspace dep, `alchemy.run.ts` bindings, `bun run typegen`

Example: call a DO’s Hono surface with `honoDoFetcherWithName(env.PingDo, "demo")` (see existing routes such as `ping-do`).

### 4. Rename the project

1. Update package names and user-facing copy.
2. Choose stable worker names in each package’s `alchemy.run.ts` when another worker refers to it by service binding.
3. Update `package.json` → `name` field.
4. Run `bun run typegen` from root.

### 5. Add environment variables

**Development:** Run root **`bun run setup`** once (creates **`.env.local`** with **`ALCHEMY_PASSWORD`** and **`CHATROOM_INTERNAL_SECRET`** if missing), or add values to repo-root **`.env.local`** (or optional per-package **`.env.local`**), not a plain **`.env`** — see [.cursor/skills/cf-workers-env-local/SKILL.md](../../.cursor/skills/cf-workers-env-local/SKILL.md) and root **[AGENTS.md](../../AGENTS.md)** (index):
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

## Type generation

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
