# Agent Instructions - Web App

This file contains important guidelines for AI agents working on the React Router 7 web application.

## Worker `env` (bindings)

Use the Cloudflare Workers virtual module only:

```typescript
import { env } from "cloudflare:workers";
```

Do **not** use `context.cloudflare.env` (or similar) from React Router for bindings — types and runtime expect `cloudflare:workers`. See root [AGENTS.md](../../AGENTS.md).

## Routes

### Adding or Editing Routes

**IMPORTANT:** React Router 7 uses file-based routing with generated types.

When you want to add or edit routes:

1. **Edit the route configuration first**: Modify `app/routes.ts` to add/remove route definitions

2. **Add or modify route files**: Create or edit files in `app/routes/`
   - `app/routes/home.tsx` - Home page route
   - `app/routes/queue.tsx` - Queue demo route
   - Add new routes following the same pattern

3. **Run typegen**: This generates the TypeScript types for your routes
   ```bash
   bun run typegen
   ```

4. **Import the generated types**: Use the generated route types in your code
   ```typescript
   import type { Route } from "./+types/my-route";
   ```

5. **Export the pathname** for `@firtoz/router-toolkit` (required for typed forms / submitters):
   ```typescript
   import { type RoutePath } from "@firtoz/router-toolkit";
   export const route: RoutePath<"/my-route"> = "/my-route";
   ```

**What this gives you:**
- Full type safety for route params, loaders, and actions
- IntelliSense for route paths and data
- Compile-time errors if you reference non-existent routes

**Never:**
- Manually edit generated type files
- Reference routes by string without using the type system
- Skip running `typegen` after adding/modifying routes
- Read Cloudflare bindings from React Router `context` instead of `import { env } from "cloudflare:workers"`

**While implementing features**, run `bun run typegen`, `bun run typecheck`, and `bun run lint` from the **monorepo root** whenever routes, wrangler, or env change — not only when finishing a task.

## Loaders and actions: `Promise<MaybeError<...>>`

- **Loaders:** return `Promise<MaybeError<YourData>>` using `success` / `fail` from `@firtoz/maybe-error` or `@firtoz/router-toolkit`. In the component, branch on `loaderData.success` then use `loaderData.result`.
- **Actions:** `formAction` handlers already return `Promise<MaybeError<...>>`; keep using `success()` / `fail()` in the handler.

## General Guidelines

Follow the main project `AGENTS.md` at the root level for:
- Linting requirements
- Environment variable management
- Worker configuration rules
