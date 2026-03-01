---
name: routing
description: React Router v7 routing patterns and environment variable configuration. Use when adding routes, configuring routing, or setting up environment variables.
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
