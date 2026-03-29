---
name: routing
description: React Router v7 routing patterns and environment variable configuration. Use whenever you touch React Router–related code (routes, links, params, loaders, actions, route config, or env in route context).
---

# React Router Routes

This project uses React Router v7 with file-based routing configured in `apps/web/app/routes.ts`.

## CRITICAL: ALWAYS Run Typegen After Editing routes.ts

**WHENEVER you edit `apps/web/app/routes.ts`, you MUST run typegen from the workspace root:**

```bash
bun run typegen
```

Run from repo root (turbo routes to the web app). **Without this, TypeScript imports will fail.** The typegen command generates the `+types` files that route components need.

## Adding a New Route

### 1. Create the Route File

Create the route file in the appropriate directory under `apps/web/app/routes/`:
- Example routes: `routes/home.tsx`, `routes/queue.tsx`
- Add new routes following the same pattern (e.g. `routes/dashboard.tsx`)

### 2. Register the Route in routes.ts

```typescript
// Example: Adding a new route
route("dashboard", "routes/dashboard.tsx"),
```

### 3. **IMMEDIATELY** Run typegen

**This step is REQUIRED, not optional!**

```bash
bun run typegen
```

Run from workspace root.

### 4. Update Imports in Your Route File

Use the generated types:

```typescript
// After typegen, this import will work:
import type { Route } from "./+types/dashboard";

export async function action({ request }: Route.ActionArgs) {
  // ...
}
```

### 5. Export the route path (`RoutePath`)

**Every route module should export its URL** so `@firtoz/router-toolkit` (e.g. `formAction`, `useDynamicSubmitter`) stays type-safe. The string must match the path registered in `routes.ts`:

```typescript
import { type RoutePath } from "@firtoz/router-toolkit";

export const route: RoutePath<"/dashboard"> = "/dashboard";
```

Omitting this is a common mistake after cloning; forms and typed submitters depend on it. See [.cursor/skills/form-submissions/SKILL.md](.cursor/skills/form-submissions/SKILL.md).

## Loaders and actions: `Promise<MaybeError<...>>`

Use [`@firtoz/maybe-error`](https://www.npmjs.com/package/@firtoz/maybe-error) (`success` / `fail`, type `MaybeError`) — also re-exported from `@firtoz/router-toolkit` — so return types are a discriminated union and TypeScript can narrow.

**Loaders**

- Annotate: `Promise<MaybeError<YourData>>`.
- Return `success({ ...fields })` or `fail("message")` (or a typed error as the second generic).
- In the route component, check `loaderData.success` before reading `loaderData.result`; handle `loaderData.error` on failure.

Deferred values (promises for `<Await>`) can live inside the success payload: `success({ items: itemsPromise })`.

**Actions**

- Prefer `formAction({ ... })` — the handler already returns `Promise<MaybeError<...>>` with validation errors folded in.
- For actions that are not `formAction`, still return `success` / `fail` the same way for consistent typing with `useFetcher` / toolkit helpers.

## Href and links (use `href` from react-router)

Import `href` from `react-router` and use it for all `<Link to>` values. Do not hardcode paths or concatenate strings.

```typescript
import { Link, href } from "react-router";
```

- **Static path:** `href("/")`, `href("/collection")`
- **Path with params:** pass the path with `:param` and an object of param values:

```tsx
<Link to={href("/")} />
<Link to={href("/collection")} />
<Link to={href("/charts/:id", { id: c.id.toString() })} />
```

## Common Mistake

Creating a route file without registering it in `routes.ts` will result in a 404. Always register new routes!

## Environment Variables

When adding new environment variables (see root AGENTS.md):

1. Add the variable to `.env.example` in the package with documentation
2. Add the same variable to `.env.local` (with a real or placeholder value for local dev)
3. Run `bun run typegen` from workspace root to regenerate TypeScript types for `env`

```bash
bun run typegen
```

The `env` object from `cloudflare:workers` is auto-generated based on what's in your wrangler config and env files.

**Do not** read bindings from React Router loader/action `context` (e.g. `context.cloudflare.env`). In this project, use:

```typescript
import { env } from "cloudflare:workers";
```
