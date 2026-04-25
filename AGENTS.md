# Agent Instructions

This file contains important guidelines for AI agents working on this codebase.

## Fork / template gotchas (read first)

These trip up new contributors and coding agents most often:

1. **Worker bindings and env** — Import the typed `env` from the Workers module, not from React Router context:
   ```typescript
   import { env } from "cloudflare:workers";
   ```
   Do **not** use `context.cloudflare.env` (or similar) for Cloudflare bindings in this stack.

2. **Route path export** — Each file under `apps/web/app/routes/` should export its path for `@firtoz/router-toolkit` (forms, typed submitters), matching `app/routes.ts`:
   ```typescript
   import { type RoutePath } from "@firtoz/router-toolkit";
   export const route: RoutePath<"/login"> = "/login";
   ```
   See [.cursor/skills/routing/SKILL.md](.cursor/skills/routing/SKILL.md).

3. **Regenerate types and verify often** — After routes, package **`alchemy.run.ts`**, or env changes, run `bun run typegen` from the repo root. Run `bun run typecheck` and `bun run lint` regularly while implementing features, not only before opening a PR. Before production deploys, run `turbo run typecheck:prod` after `typegen:prod` if you changed prod bindings.

4. **Loaders and actions return `Promise<MaybeError<...>>`** — Use `success` / `fail` (and the `MaybeError` type) from `@firtoz/maybe-error` directly. Annotate loaders as `Promise<MaybeError<YourLoaderData>>`, return `success({ ... })` or `fail("...")`, and narrow in the route component with `loaderData.success`. Use `formAction` from `@firtoz/router-toolkit` for actions so the handler stays `Promise<MaybeError<...>>` as well.

5. **Index route + `formAction` / `useDynamicSubmitter` → 405** — Use a **non-index** route (e.g. `/visitors`) for POST+form tools, or match React Router’s `/?index` behavior for the index route. See [apps/web/app/routes](apps/web/app/routes).

6. **Export `formSchema`** (and related router-toolkit exports) for typed submitters when you use them.

7. **Alchemy + D1** — Root **`alchemy.run.ts`** defines **`D1Database`** with **`migrationsDir`** pointing at **`packages/db/drizzle`**. Alchemy applies SQL migrations on deploy/dev per [D1 + Drizzle](https://alchemy.run/guides/drizzle-d1/). Do not hand-manage **`D1_DATABASE_ID`** in env for the default flow.

8. **Turbo / stale `typegen`** — If route types look wrong, run `turbo run typegen:local --force` (or `typegen:prod` after env changes).

9. **JSDoc** — Do not use `*/` inside a `/** ... */` block (it ends the comment early). General TypeScript gotcha.

10. **Empty local D1 on a fresh clone** — Run **`bun run dev`** (repo root) so package-local Alchemy dev sessions can initialize local bindings; until then D1 queries may fail.

11. **Biome `check --write`** — Can modify files after you think you are finished; re-run **`bun run lint`** or review the diff before calling the task done.

12. **Dev server port** — Vite may pick **5174+** if **5173** is in use; do not hardcode a port when verifying in the browser. **Do not** set a fixed **`server.hmr.port`** here: React Router’s **client + SSR** Vite environments each start an HMR WebSocket server and will collide on one port; **`@cloudflare/vite-plugin`** already ignores Vite HMR upgrades (`sec-websocket-protocol: vite…`) and forwards other **`/api/ws/*`** upgrades to Miniflare.

13. **Prod D1 / visitors errors** — If **`/visitors`** fails after deploy, confirm **`bun alchemy deploy`** completed and D1 migrations ran; see [Alchemy D1Database](https://alchemy.run/providers/cloudflare/d1-database/).

Cursor also loads [.cursor/rules/cf-workers-patterns.mdc](.cursor/rules/cf-workers-patterns.mdc) on every conversation as a short reminder.

## Project initialization (forks)

If this repo is a **fork or template copy** that still has root `package.json` `"name": "cf-multiworker-starter-kit"` and the user wants their own app name, deployable worker names, and docs—follow the **project-init** skill: [.cursor/skills/project-init/SKILL.md](.cursor/skills/project-init/SKILL.md). The always-applied rule [.cursor/rules/project-init.mdc](.cursor/rules/project-init.mdc) explains when to offer this (and when **not** to, e.g. when working on the upstream starter kit repo).

## For Cloud Agents

**If you're a Cloud Agent, read this first:** [.cursor/rules/00-cloud-agent-mandatory.mdc](.cursor/rules/00-cloud-agent-mandatory.mdc)

Setup runs automatically via `.cursor/environment.json`. If bun is not available:

```bash
cd /workspace && bash ./.cursor/setup-agent.sh && source ~/.bashrc
```

## Run From Repo Root

Always run build, typecheck, lint, and typegen from the workspace root. Turbo handles packages and task order.

```bash
bun run build
bun run typecheck
bun run lint
bun run typegen
```

## Turborepo

- **`^task`** — In `apps/web/turbo.json`, a leading `^` runs `task` in every workspace package listed in `apps/web` **dependencies** / **devDependencies** (e.g. `^typecheck:local`). Add a workspace package to **`package.json`** if its tasks must run before yours; avoid hard-coding `other-pkg#…` for every graph when **`^`** suffices.
- **Per-package `inputs`** — List **only that package’s files** in each `turbo.json` (see skill). Do not add sibling packages’ source trees to **another** package’s `inputs` to force cache busts—use **`^task`** and workspace deps so upstream outputs change the graph.
- **Caching** — Tasks are cached when hashes of **inputs**, **outputs**, and declared **`env`** match. By design only **`dev`** and **`clean`** set `cache: false` at the root. Use **`turbo run <task> --force`** when you must bypass cache.
- More detail: [.cursor/skills/turborepo/SKILL.md](.cursor/skills/turborepo/SKILL.md).

## Package Installation

Install packages from the repo root. Use workspace filtering to add dependencies to a specific app:

```bash
bun add <package-name>@latest --filter apps/web
# or if filter doesn't work:
bun add <package-name>@latest --cwd apps/web
```

## Code Quality

### Always Check Lints After Editing

After making any changes to files, always run linter checks on the files you edited. You can use any lint tools you have first, and once you're done, also run:

```bash
bun run lint
```

Fix any linting errors before considering the task complete. This project uses Biome for linting and formatting.

## Worker configuration

### Package `alchemy.run.ts` and `env.d.ts`

- **Source of truth** — Each deployable package owns a conventional **`alchemy.run.ts`** and exports its Alchemy resources through **`"./alchemy"`** when another package consumes them ([Alchemy Turborepo guide](https://alchemy.run/guides/turborepo/), [type-safe bindings](https://alchemy.run/concepts/bindings/#type-safe-bindings)).
- **Root scripts** — `bun run dev`, `bun run deploy`, and `bun run destroy` call Turbo graphs. Package deploy/destroy scripts call `alchemy deploy/destroy --app <package-id>`; worker dev scripts may use Wrangler when local service-binding discovery needs it.
- **`apps/web/env.d.ts`** — `export type CloudflareEnv = (typeof web)["Env"]`.
- **`durable-objects/*/env.d.ts`** — `export type CloudflareEnv = (typeof packageWorker)["Env"]`.
- **Cross-package bindings** — Providers export resources from `./alchemy`; consumers import `providerWorker.bindings.MyDo` in their own package `alchemy.run.ts` for cross-script DOs. Script-name `WorkerRef`s are still okay for intentional service-binding cycles.

### Adding another Durable Object (cross-script)

1. **Scaffold** — `bunx turbo gen durable-object` (or copy **`durable-objects/ping-do/`**). The generator creates package-local `alchemy.run.ts`, `env.d.ts`, and a public `readonly app`.
2. **Alchemy app** — Provider package exports its DO namespace/worker from `./alchemy`. Consumers add a workspace dependency and import that resource in their own `alchemy.run.ts`.
3. **Types** — Add **`"your-do": "workspace:*"`** to **`apps/web/package.json`** if Turbo should run that package’s **`^typecheck`** before the web app.
4. **Verify** — `bun run dev`, exercise **`env.YourDo`** or `honoDoFetcherWithName(env.YourDo, "name")`, confirm existing DOs still work.

## Environment Variables

### Adding New Environment Variables

When adding new environment variables to any worker:

1. **Document new variables in repo-root `.env.example`** (human-readable reference only — never commit secrets). Real values live in **`.env.local`** (dev) and **`.env.production`** (prod / CI); those files are gitignored.

2. **Wire bindings in package `alchemy.run.ts`** — Add vars or `alchemy.secret(...)` to the relevant package app; see [Secrets](https://alchemy.run/providers/cloudflare/secret/).

3. **Bindings** — Add vars in package Alchemy apps only; `env.d.ts` follows that package's exported worker resource.

4. **Run typegen** for React Router route types:
   ```bash
   bun run typegen
   ```

**Access in code:** use the generated bindings via the Workers virtual module only:

```typescript
import { env } from "cloudflare:workers";
// env.MY_NEW_VAR, env.SomeDoBinding, etc.
```

Do not use React Router loader/action `context` to reach Cloudflare `env`; it is not the source of truth here.

**What happens:**
- **`bun run dev`** runs **`turbo run dev`**. Each deployable package starts its own Alchemy dev session.
- **`bun run typegen`** refreshes React Router types. Cloudflare **`Env`** follows package-local Alchemy exports via **`env.d.ts`** (see Worker configuration).

**Important:**
- `.env.local` and `.env.production` are gitignored
- **`.env.example` is documentation** — keep it updated when you add new vars (names and semantics only). It is **not** read by setup or tooling.
- Never commit secrets or API keys to `.env.example` — document names and semantics only.

## Deploy

- **Local:** `bun run dev` → **`turbo run dev`**. Turbo starts one Alchemy dev session per app/worker, matching Alchemy's Turborepo guidance.
- **Production:** `bun run deploy` → **`turbo run deploy`**. Set **`CLOUDFLARE_API_TOKEN`** / account as in [Getting Started](https://alchemy.run/getting-started/). **`alchemy.secret()`** requires an encryption password; **`alchemy/password.ts`** uses a documented dev-only default when **`ALCHEMY_PASSWORD`** is unset so local **`bun run dev`** works; set a strong **`ALCHEMY_PASSWORD`** for production, CI, and shared state ([encryption password](https://alchemy.run/concepts/secret/#encryption-password)).

## Type Generation

After making changes to worker configurations, environment variables, or `apps/web/app/routes.ts`, always run:

```bash
bun run typegen
```

Run it **during** feature work whenever those areas change, not only at the end. Pair with `bun run typecheck` so TypeScript errors surface immediately.

This generates:
- React Router route types (in the web app)

Cloudflare **`Env`**: update package **`alchemy.run.ts`** apps; **`env.d.ts`** follows exported package worker resources without per-binding edits unless Alchemy’s binding shapes change.

## Completion Checklist

Before considering the task complete:

- [ ] If you touched routes, `alchemy.run.ts`, `env.d.ts`, or env: `bun run typegen` (repo root; local stack). For prod parity: `turbo run typegen:prod` then `turbo run typecheck:prod`.
- [ ] Lint passes: `bun run lint`
- [ ] Typecheck passes: `bun run typecheck`
- [ ] If you made code changes and you're a Cloud Agent: `git add`, `git commit`, `git push` (do not skip)
