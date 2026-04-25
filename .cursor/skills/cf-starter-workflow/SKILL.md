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

## Typegen, typecheck, and lint cadence

During feature work, whenever you change routes, `apps/web/app/routes.ts`, any `alchemy.run.ts`, or env / bindings:

- `bun run typegen` (React Router + local env assumptions)
- `bun run typecheck`
- `bun run lint` before calling the task done (Biome may rewrite; re-run as needed)

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

**Deploy / secrets:** `bun run deploy` → `turbo run deploy`. `alchemyPassword` in [cf-starter-alchemy](../../../packages/cf-starter-alchemy) requires **`ALCHEMY_PASSWORD`** (and the web app needs **`SESSION_SECRET`**). Run **`bun run setup`** in a terminal for a confirmation prompt, or **`bun run setup -- --yes`** / **`bun packages/scripts/setup-env.ts --yes`** in automation. [Alchemy — encryption password](https://alchemy.run/concepts/secret/#encryption-password), [Getting Started](https://alchemy.run/getting-started/) for `CLOUDFLARE_API_TOKEN`.

- **Local dev** — `bun run dev` runs a filtered `turbo run dev` (web + worker apps), each with `alchemy dev --app …` per [Alchemy monorepo](https://alchemy.run/guides/turborepo/).

## Completion checklist (before you stop)

- [ ] Touched routes, `alchemy.run.ts`, `env.d.ts`, or env → `bun run typegen` (and prod pair if needed).
- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] Cloud Agent: `git add`, `git commit`, `git push` (do not skip) when the session expects it. [.cursor/rules/00-cloud-agent-mandatory.mdc](../../rules/00-cloud-agent-mandatory.mdc)

## Related

- [cf-starter-gotchas](../cf-starter-gotchas/SKILL.md) — numbered gotchas and edge cases.
- [project-init](../project-init/SKILL.md) — rename workers/docs after forking the template.
- [packages/scripts/dev-preflight.ts](../../../packages/scripts/dev-preflight.ts) — `scripts#dev:preflight` checks wrangler/miniflare alignment (Turbo `dev` dependency).
