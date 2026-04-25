---
name: cf-durable-object-package
description: Add or change a Durable Object worker package under durable-objects/ (Alchemy, env.d.ts, Hono on the DO). Use when scaffolding with turbo gen durable-object, editing durable-objects/*/alchemy.run.ts, workers/app.ts, or env.d.ts for a DO. Not for web app bindings or cross-worker rpc—see cf-web-alchemy-bindings and cf-worker-rpc-turbo.
---

# Durable Object package (Alchemy + Hono)

## When to use

- New package under `durable-objects/<name>/` (generator or copy an example).
- Changing `DurableObjectNamespace`, `Worker`, entrypoint, or the DO’s Hono app.

## Steps

1. **Package layout** — At minimum: `alchemy.run.ts`, `env.d.ts`, `workers/app.ts`, `package.json` with `"exports": { "./alchemy": "./alchemy.run.ts" }`, `tsconfig.json`. Reference: [durable-objects/ping-do](durable-objects/ping-do) (Hono + DO + WorkerEntrypoint) or [durable-objects/chatroom-do](durable-objects/chatroom-do) (DO-focused).

2. **`alchemy.run.ts`** — `await alchemy("<app-id>", { password: alchemyPassword })` with `import { alchemyPassword } from "cf-starter-alchemy"` (see [cf-starter-alchemy](../../../packages/cf-starter-alchemy)). Add `"cf-starter-alchemy": "workspace:*"` to this package’s `devDependencies`. Export `DurableObjectNamespace<YourDoRpc>` (use type from `./workers/rpc` or `./workers/your-do.ts` as in repo), then `Worker(..., { entrypoint: new URL("./workers/app.ts", import.meta.url).pathname, bindings: { YourDo, ... }, adopt: true, ... })`. Stable `name:` strings matter for cross-script `WorkerRef`.

3. **`env.d.ts`** — `export type CloudflareEnv = (typeof <yourExportedWorker>)["Env"]`. `declare global { type Env = CloudflareEnv }` and `declare module "cloudflare:workers"` `Env` merge (match [durable-objects/ping-do/env.d.ts](durable-objects/ping-do/env.d.ts)).

4. **Hono** — In `workers/app.ts`: `import type { CloudflareEnv } from "../env"`, `const app = new Hono<{ Bindings: CloudflareEnv }>()` (same as [durable-objects/other-worker/workers/app.ts](durable-objects/other-worker/workers/app.ts)).

5. **Scripts** — Prefer `alchemy dev --app <kebab-id>` in `package.json` `dev` (not raw `wrangler dev` for this monorepo’s flow). Align `deploy` / `destroy` with `--app` id.

6. **After edits** — From repo root: `bun run typegen` and `bun run typecheck` (or package-local `typecheck:local`).

## Next (outside this skill)

- Wire the web app: [cf-web-alchemy-bindings](../cf-web-alchemy-bindings/SKILL.md).
- `workers/rpc.ts`, `WorkerRef`, root `dev` / `destroy`: [cf-worker-rpc-turbo](../cf-worker-rpc-turbo/SKILL.md).
