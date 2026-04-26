---
name: cf-starter-gotchas
description: Fork and template gotchas (env import, routes, typegen, forms, D1, Turbo, HMR, new DO packages). Use when working on apps/web or durable-objects, or when behavior diverges from this stack’s conventions.
---

# cf-multiworker — fork / template gotchas

These trip up new contributors and agents most often. For commands and checklists, see [cf-starter-workflow](../cf-starter-workflow/SKILL.md).

1. **Worker bindings and env** — Import the typed `env` from the Workers virtual module, not from React Router context: `import { env } from "cloudflare:workers"`. **Do not** use `context.cloudflare.env` (or similar) for Cloudflare bindings in this stack. More: [.cursor/rules/cf-workers-patterns.mdc](../../rules/cf-workers-patterns.mdc).

2. **Route path export** — Each file under `apps/web/app/routes/` should export its path for `@firtoz/router-toolkit` (forms, typed submitters), matching `app/routes.ts` (`export const route: RoutePath<"/login"> = "/login";`). [routing/SKILL.md](../routing/SKILL.md).

3. **Regenerate types and verify often** — After routes, `alchemy.run.ts`, or env changes, run `bun run typegen` from the repo root. Run `bun run typecheck` and `bun run lint` regularly while building, not only before a PR. Before production deploys, run `turbo run typecheck:prod` after `typegen:prod` if you changed prod bindings. [cf-starter-workflow](../cf-starter-workflow/SKILL.md). **`ALCHEMY_PASSWORD`** is required (no in-repo default) — `bun run setup` (interactive **[Y/n]** in a real TTY) or `bun run setup -- --yes` / `CI=true` seed **`.env.local`**; **`bun run setup:prod`** is the same for **`.env.production`**.

4. **Loaders and actions return `Promise<MaybeError<...>>`** — Use `success` / `fail` (and the `MaybeError` type) from `@firtoz/maybe-error` **directly** (they are not re-exported by `@firtoz/router-toolkit`). Annotate loaders, narrow with `loaderData.success`. Use `formAction` for actions. [form-submissions/SKILL.md](../form-submissions/SKILL.md), [routing/SKILL.md](../routing/SKILL.md).

5. **Index route + `formAction` / `useDynamicSubmitter` → 405** — Use a **non-index** route (e.g. `/visitors`) for POST+form tools, or match React Router’s `/?index` behavior for the index route. See `apps/web/app/routes/`.

6. **Export `formSchema`** (and related router-toolkit exports) for typed submitters when you use them. [form-submissions/SKILL.md](../form-submissions/SKILL.md).

7. **Alchemy + D1** — The web [alchemy.run.ts](../../../apps/web/alchemy.run.ts) defines `D1Database` with `migrationsDir` pointing at `packages/db/drizzle`. Alchemy applies SQL migrations on deploy/dev per [D1 + Drizzle](https://alchemy.run/guides/drizzle-d1/). Do not hand-manage `D1_DATABASE_ID` in env for the default flow.

8. **Turbo / stale `typegen`** — If route types look wrong, run `turbo run typegen:local --force` (or `typegen:prod` after env changes). [turborepo/SKILL.md](../turborepo/SKILL.md).

9. **JSDoc** — Do not use `*/` inside a `/** ... */` block (it ends the comment early). General TypeScript gotcha.

10. **Empty local D1 on a fresh clone** — Run `bun run dev` (repo root) so package-local Alchemy dev sessions can initialize local bindings; until then D1 queries may fail.

11. **Biome `check --write`** — Can modify files after you think you are done; re-run `bun run lint` or review the diff before finishing.

12. **Dev server port** — Vite may pick **5174+** if 5173 is in use; do not hardcode a port when checking in the browser. **Do not** set a fixed `server.hmr.port`: React Router’s client + SSR Vite envs each start an HMR WebSocket server; `@cloudflare/vite-plugin` already ignores Vite HMR upgrades (`sec-websocket-protocol: vite…`) and forwards other `/api/ws/*` upgrades to Miniflare.

13. **Prod D1 / visitors errors** — If `/visitors` fails after deploy, confirm `bun alchemy deploy` completed and D1 migrations ran; see [Alchemy D1Database](https://alchemy.run/providers/cloudflare/d1-database/).

14. **New Durable Object / worker package** — Use `import type { CloudflareEnv }` and `new Hono<{ Bindings: CloudflareEnv }>()` in DO workers so `c.env` is typed. Shared RPC types in `workers/rpc.ts` (no `import` from `../env` there); add `package.json#exports` `"./workers/rpc"` when needed. `WorkerRef` / cross-worker: one `workspace:*` direction; the other side uses a relative `../<pkg>/workers/rpc` import to avoid Turbo cycles. New Alchemy apps: root [package.json](../../../package.json) `dev` filter, [turbo.json](../../../turbo.json) `<pkg>#destroy` with `dependsOn: ["cf-starter-web#destroy"]`. **Do not** add another package’s `workers/app.ts` to [tsconfig.cloudflare.json](../../../apps/web/tsconfig.cloudflare.json) `include`—it can break `cf-starter-web`’s `Env`. Step-by-step: [cf-durable-object-package/SKILL.md](../cf-durable-object-package/SKILL.md), [cf-web-alchemy-bindings/SKILL.md](../cf-web-alchemy-bindings/SKILL.md), [cf-worker-rpc-turbo/SKILL.md](../cf-worker-rpc-turbo/SKILL.md).

15. **Durable Object RPC `using` in local dev** — `@firtoz/hono-fetcher` types real DO HTTP results as disposable when Workers RPC attaches `[Symbol.dispose]`, but Vite SSR / some Miniflare paths may return plain `Response` objects. If `using res = await api.get(...)` throws `Symbol(Symbol.dispose) is not a function`, use `const res = await api.get(...)` in that local route or guard disposer calls. `using api = honoDoFetcherWithName(...)` is safer because the library guards missing stub disposers.

16. **Alchemy dev stale web process state** — If `bun run dev` prints `webUrl: "http://localhost:5173/"` but port 5173 is closed after a web crash, check generated Alchemy state. Remove `.alchemy/pids/cf-starter-web.pid.json` and `.alchemy/web/local/cf-starter-web.json`, ensure `.alchemy/logs/cf-starter-web.log` exists (create an empty file if needed), then restart `bun run dev`. Do not commit `.alchemy/` files.

## Also load

- [.cursor/rules/cf-workers-patterns.mdc](../../rules/cf-workers-patterns.mdc) — short always-on reminder for workers, env, routes.
