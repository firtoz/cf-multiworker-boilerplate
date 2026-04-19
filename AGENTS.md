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

3. **Regenerate types and verify often** — After routes, wrangler, or env changes, run `bun run typegen` from the repo root (runs `typegen:local` via Turbo). Run `bun run typecheck` and `bun run lint` regularly while implementing features, not only before opening a PR. Before production deploys, run `turbo run typecheck:prod` after `typegen:prod` if you changed prod bindings.

4. **Loaders and actions return `Promise<MaybeError<...>>`** — Use `success` / `fail` (and the `MaybeError` type) from `@firtoz/maybe-error` directly. Annotate loaders as `Promise<MaybeError<YourLoaderData>>`, return `success({ ... })` or `fail("...")`, and narrow in the route component with `loaderData.success`. Use `formAction` from `@firtoz/router-toolkit` for actions so the handler stays `Promise<MaybeError<...>>` as well.

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

- **`^task`** — In `apps/web/turbo.json`, a leading `^` runs `task` in every workspace package listed in `apps/web` **dependencies** / **devDependencies** (e.g. `^generate-wrangler:local`, `^deploy` on `deploy:execute`). Avoids hard-coding `example-do#…` in every graph.
- **Caching** — Tasks are cached when hashes of **inputs**, **outputs**, and declared **`env`** match. By design only **`dev`** and **`clean`** set `cache: false` at the root. Use **`turbo run <task> --force`** when you must bypass cache (e.g. repeat **`deploy:execute`** without file changes).
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

## Worker Configuration

### Never Edit Worker Config Files by Hand

**DO NOT manually edit these files:**
- `worker-configuration.d.ts` (in any package)
- `wrangler-dev.jsonc` / `wrangler-prod.jsonc` (generated; edit `wrangler.jsonc.hbs` and run `bun run generate-wrangler:local` / `:prod` from each package, or use root `typegen`)

Committed source of truth for Wrangler shape is **`wrangler.jsonc.hbs`** per worker package. Bindings and vars belong there; generated JSONC is gitignored.

## Environment Variables

### Adding New Environment Variables

When adding new environment variables to any worker:

1. **Document new variables in repo-root `.env.example`** (human-readable reference only — never commit secrets; **no script reads this file**). **`generate-wrangler`**, **`cf-typegen`**, **`bun run setup`**, and **`bun run setup:prod`** do **not** load **`.env.example`**. Real values live in **`.env.local`** (dev) and **`.env.production`** (prod); those files are gitignored.

2. **Prod wrangler generation** — `generate-wrangler --mode=remote` merges **only** deployment keys from repo-root `.env.production` (see `getDeploymentKeys` in `packages/scripts/src/utils/workspace-worker-catalog.ts`, built from `wrangler.jsonc.hbs` under `apps/` and `durable-objects/`) onto `process.env`, plus any `*_WORKER_NAME` entries in the file.

3. **If the var is interpolated into Wrangler config** (e.g. `$MY_NEW_VAR` in `wrangler.jsonc.hbs`), set it in **`.env.local`** / **`.env.production`** (or CI) so `wrangler types` and deploys see real values. New workers pick up `*_WORKER_NAME` keys automatically when you add a package with `wrangler.jsonc.hbs`. For other vars that must participate in remote wrangler generation but are not worker names or routes, extend `getDeploymentKeys` in `workspace-worker-catalog.ts` (or pass them via CI `process.env` if Wrangler reads them without template substitution).

4. **Run typegen** to update the worker configuration type definitions:
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
- Real env files (repo-root **`.env.local`** / **`.env.production`**, and optional per-package **`.env.local`**) feed `wrangler types` and builds via explicit `--env-file` — never plain **`.env`**, never **`.env.example`**.
- Typegen updates `worker-configuration.d.ts` from Wrangler output.

**Important:**
- `.env.local` and `.env.production` are gitignored
- **`.env.example` is documentation** — keep it updated when you add new vars (names and semantics only). It is **not** read by setup or tooling.
- Never commit secrets or API keys to `.env.example` — document names and semantics only.

## Deploy (dry-run vs live)

- **`bun run setup`** writes **`.env.local`** (local dev). **`bun run setup:prod`** writes **`.env.production`** (prod deploy); adding a worker package with `wrangler.jsonc.hbs` updates the catalog used by **`prod-env-manifest.ts`** and the setup wizards — no manual list of four worker names in bootstrap.
- **Prerequisite** — Repo-root **`.env.production`** must exist for prod deploy commands. Create it with **`bun run setup:prod`** or edit it by hand (see **`.env.example`** as a checklist only). **`bun run check-prod-env`** exits immediately with a concrete checklist if it is missing (same check runs at the start of **`deploy`** / **`deploy:execute`**). **`.env.local` alone is not enough** for those flows. Typical first-time flow: **`setup:prod`** → **`check-prod-env`** → **`deploy`** (dry-run) or **`deploy:execute`** (live).
- **`bun run deploy`** — Runs `scripts#wrangler:dry-run:prod` (after `cf-starter-web#build:prod`): `wrangler deploy --dry-run` for each Durable Object package and the web app. **No live upload**, no `pre-deploy` queue creation.
- **`bun run deploy:execute`** — Loads **`.env.production`** via root `package.json` (`--env-file`). Runs **`scripts#sync-secrets:prod`** (uploads values for `secrets.required` in `wrangler-prod.jsonc`, e.g. `SESSION_SECRET`, when they differ from a local hash cache), then **`scripts#pre-deploy`** (queues / checks), **`build:prod`**, **`^deploy`**, then the web app **`wrangler deploy`**. If Cloudflare still reports missing secrets after a successful sync, run `turbo run sync-secrets:prod --filter=scripts -- --force` or fix values in `.env.production`.

## Type Generation

After making changes to worker configurations, environment variables, or `apps/web/app/routes.ts`, always run:

```bash
bun run typegen
```

Run it **during** feature work whenever those areas change, not only at the end. Pair with `bun run typecheck` so TypeScript errors surface immediately.

This generates:
- Cloudflare Worker binding types (`worker-configuration.d.ts`)
- React Router route types (in the web app)
- Durable Object type imports

## Completion Checklist

Before considering the task complete:

- [ ] If you touched routes, wrangler, or env: `bun run typegen` (repo root; local stack). For prod parity: `turbo run typegen:prod` then `turbo run typecheck:prod`.
- [ ] Lint passes: `bun run lint`
- [ ] Typecheck passes: `bun run typecheck`
- [ ] If you made code changes and you're a Cloud Agent: `git add`, `git commit`, `git push` (do not skip)
