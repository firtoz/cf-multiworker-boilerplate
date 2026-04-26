---
name: cf-starter-workflow
description: Repo-root commands, typegen and typecheck cadence, lint, deploy, adding packages with bun, and Alchemy app layout. Use at the start of a task, before PR, or when choosing turbo/typegen commands.
---

# cf-multiworker — agent workflow and workspace layout

## Run from repo root

Build, typecheck, lint, and typegen from the **workspace root** so Turbo can order work across packages.

```bash
bun run build
bun run typecheck
bun run lint
bun run typegen
```

Avoid `cd apps/web && …` for those unless you are debugging a single package in isolation; the root scripts define the monorepo graph. More: [turborepo/SKILL.md](../turborepo/SKILL.md).

## Generated artifacts and Drizzle migrations

Generated files are output, not source of truth. Do not manually author React Router `+types`, Drizzle SQL migrations, Drizzle `meta/*.json` snapshots, lockfiles, or `.alchemy/` state. Change the source file and run the generator/package manager instead.

For Drizzle:

1. Edit `packages/db/src/schema.ts` for root D1, or `durable-objects/<name>/src/schema.ts` for package-local Durable Object SQLite.
2. Run `bun run db:generate` for root D1, or the DO package's `db:generate` script when present.
3. Commit the generated SQL/meta output. PR review should flag hand-written migration SQL or fabricated snapshot JSON unless the change explicitly says it is repairing generated history.

## Typegen, typecheck, and lint cadence

During feature work, test after each meaningful sub-step with the narrowest useful check. Commit after a stable verified checkpoint, then push/update the PR. Avoid waiting until the end to discover typegen, typecheck, lint, or migration drift.

Whenever you change routes, `apps/web/app/routes.ts`, any `alchemy.run.ts`, or env / bindings:

- `bun run typegen` (React Router + local env assumptions)
- `bun run typecheck`
- `bun run lint` before calling the task done (Biome may rewrite; re-run as needed)

Whenever you change Drizzle schema:

- Root D1: `bun run db:generate`
- Durable Object SQLite: package-local `db:generate` if present
- Then run `bun run typecheck` and `bun run lint` from the repo root

For **production** parity: `turbo run typegen:prod` then `turbo run typecheck:prod` if prod env differs.

**Cloudflare `Env`:** Comes from each package’s `env.d.ts` and the worker resource exported from that package’s `alchemy.run.ts` (web uses `WebBindingResources` + `Bindings.Runtime<… & { ASSETS }>`; see [apps/web/env.d.ts](../../../apps/web/env.d.ts), [apps/web/alchemy.run.ts](../../../apps/web/alchemy.run.ts)).

## Package installation

Install from the repo root; scope adds to a single app when needed.

```bash
bun add <package>@latest --filter apps/web
# or
bun add <package>@latest --cwd apps/web
```

## Turborepo (short)

- **`^task`** in a package’s `turbo.json` runs `task` in **workspace dependencies**; prefer that over listing every `other-pkg#…` by hand.
- **Per-package `inputs`** — only that package’s files; use `^` + workspace deps to invalidate, not other packages’ source trees. [turborepo/SKILL.md](../turborepo/SKILL.md).
- **Cache** — only `dev` and `clean` are `cache: false` at root by design; `turbo run <task> --force` to bypass when needed.

## D1 and Alchemy migrations

The root D1 schema source of truth is `packages/db/src/schema.ts`. Do not add runtime `CREATE TABLE` fallbacks in app loaders/actions to compensate for missed migrations.

After D1 schema changes:

1. Run `bun run db:generate`.
2. Run `bun run dev` or `bun run deploy`.
3. Turbo/Alchemy should apply the generated migrations through `D1Database.migrationsDir` in `apps/web/alchemy.run.ts` (`packages/db/drizzle`).

`bun run d1:migrate:local` and `bun run d1:migrate:remote` are informational in this starter; the web package Alchemy app owns local and remote D1 migration application.

If local dev still reports `no such table`:

- Check that `bun run db:generate` produced or preserved the expected migration.
- Check that `apps/web/alchemy.run.ts` points `D1Database.migrationsDir` at `packages/db/drizzle`.
- Restart `bun run dev`.
- If generated local state is stale, stop dev and remove the relevant local `.alchemy/` app state before restarting. Do not commit `.alchemy/`.

## Alchemy in this monorepo (summary)

- **Source of truth** — Each deployable package owns an `alchemy.run.ts` and, when consumed elsewhere, exports via `"./alchemy"` (see [Alchemy Turborepo](https://alchemy.run/guides/turborepo/), [type-safe bindings](https://alchemy.run/concepts/bindings/#type-safe-bindings)).
- **Root** — `bun run dev` / `deploy` / `destroy` call Turbo; package scripts use `alchemy dev|deploy|destroy --app <package-id>`.
- **Cross-package** — Provider packages export from `./alchemy`; consumers use `providerWorker.bindings.YourResource` in their `alchemy.run.ts` for cross-script DOs. Details: [cf-web-alchemy-bindings/SKILL.md](../cf-web-alchemy-bindings/SKILL.md), [cf-durable-object-package/SKILL.md](../cf-durable-object-package/SKILL.md).

## Adding another Durable Object (quick path)

1. `bunx turbo gen durable-object` (or copy `durable-objects/ping-do/`).
2. Export DO/worker from `./alchemy`; wire [apps/web/alchemy.run.ts](../../../apps/web/alchemy.run.ts) and root `dev` / `destroy` (see [cf-starter-gotchas](../cf-starter-gotchas/SKILL.md) #14, [cf-worker-rpc-turbo/SKILL.md](../cf-worker-rpc-turbo/SKILL.md)).
3. `bun run dev`, exercise bindings, confirm existing DOs still work.

## Environment variables and secrets

Real keys: **`.env.local`** (dev), **`.env.production`** (prod/CI). **`.env.example`** is documentation only. Never commit secrets. Full checklist: [cf-workers-env-local/SKILL.md](../cf-workers-env-local/SKILL.md), [Alchemy Secret](https://alchemy.run/providers/cloudflare/secret/).

Access in app code: `import { env } from "cloudflare:workers"` only.

**Deploy / secrets:** `bun run deploy` → **`turbo run deploy --filter=cf-starter-web`** (pulls dependent worker deploys). `alchemyPassword` in [cf-starter-alchemy](../../../packages/cf-starter-alchemy) requires **`ALCHEMY_PASSWORD`**; the chatroom secret example requires **`CHATROOM_INTERNAL_SECRET`**. Run **`bun run setup`** in a terminal for a confirmation prompt, or **`bun run setup -- --yes`** / **`bun packages/scripts/setup-env.ts --yes`** in automation. [Alchemy — encryption password](https://alchemy.run/concepts/secret/#encryption-password), [Getting Started](https://alchemy.run/getting-started/) for `CLOUDFLARE_API_TOKEN`.

- **Local dev** — `bun run dev` runs a filtered `turbo run dev` (web + worker apps), each with `alchemy dev --app …` per [Alchemy monorepo](https://alchemy.run/guides/turborepo/). When verifying setup, exercise `/`, `/visitors`, `/ping-do`, and `/chat`; this covers React Router SSR, D1, cross-script DO bindings, and chat WebSockets. If web prints `webUrl` but port 5173 is closed after a crash, remove the stale generated `.alchemy/pids/cf-starter-web.pid.json`; if you also remove `.alchemy/logs/cf-starter-web.log`, recreate it before restarting because Alchemy's idempotent log follower expects the file to exist.

## Completion checklist (before you stop)

- [ ] Touched routes, `alchemy.run.ts`, `env.d.ts`, or env → `bun run typegen` (and prod pair if needed).
- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] **Cloud agents** (if your session is a cloud task): when you changed code, **`git add` / `git commit` / `git push` before you finish** — do not leave changes only in the working tree. [.cursor/rules/00-cloud-agent-mandatory.mdc](../../rules/00-cloud-agent-mandatory.mdc). **IDE / local chat agents** usually do not commit: [.cursor/rules/git-workflow.mdc](../../rules/git-workflow.mdc).

## Related

- [cf-starter-gotchas](../cf-starter-gotchas/SKILL.md) — numbered gotchas and edge cases.
- [project-init](../project-init/SKILL.md) — rename workers/docs after forking the template.
- [packages/scripts/dev-preflight.ts](../../../packages/scripts/dev-preflight.ts) — `scripts#dev:preflight` checks wrangler/miniflare alignment (Turbo `dev` dependency).
