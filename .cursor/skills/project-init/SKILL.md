---
name: project-init
description: Personalizes a fork of this Cloudflare multi-worker monorepo—worker names in wrangler, package names, README, and UI—so deploys and docs are not stuck on starter kit defaults. Use when the user created a repo from the template, wants to deploy their own app, or asks to rename workers, rebrand, or remove generic starter kit copy. Skip when developing the upstream starter kit (origin URL contains firtoz/cf-multiworker-starter-kit; canonical https://github.com/firtoz/cf-multiworker-starter-kit) unless the user explicitly asks.
---

# Project initialization (personalize your fork)

Use this skill when someone is building **their** app on top of this starter kit—not when maintaining the upstream repo at [https://github.com/firtoz/cf-multiworker-starter-kit](https://github.com/firtoz/cf-multiworker-starter-kit).

**Guard:** If `git remote get-url origin` contains `firtoz/cf-multiworker-starter-kit`, do **not** run this flow unless the user explicitly requests renaming or templating work.

**Note:** Root [AGENTS.md](../../AGENTS.md) says to avoid hand-editing `wrangler.jsonc` in general. **This skill is the exception** for forks: renaming workers and bindings for deployment is intentional; still run `bun run typegen` after wrangler changes.

## 1. Gather information

Ask the user (or infer from context):

- **Project slug** — npm-safe name, e.g. `my-saas-app` (used for root `package.json` `name` and naming).
- **One-line description** — for README, meta tags, and home hero copy.
- **Example DO** — keep `durable-objects/example-do` or plan to remove it and its bindings (if removed, update `apps/web` bindings, deps, and routes that use `ExampleDo`).
- **Queue demo** — keep `coordinator-do` / `processor-do` / `/queue` or plan to strip them (larger refactor; update all bindings, queues, routes, and docs).

## 2. Wrangler worker names and cross-references

Every worker’s `wrangler.jsonc` has a top-level `"name"` (Cloudflare worker script name). Workers that call other DOs use `"script_name"` pointing at those names. **All names must stay consistent** across files.

| File | Default `name` | `script_name` references |
|------|----------------|----------------------------|
| `apps/web/wrangler.jsonc` | `cf-starter-web` | `cf-starter-example-do`, `cf-starter-coordinator-do` |
| `durable-objects/example-do/wrangler.jsonc` | `cf-starter-example-do` | — |
| `durable-objects/coordinator-do/wrangler.jsonc` | `cf-starter-coordinator-do` | `cf-starter-processor-do` |
| `durable-objects/processor-do/wrangler.jsonc` | `cf-starter-processor-do` | `cf-starter-coordinator-do` |

**Circular DO bindings (2-node `script_name` cycles):** Use **`packages/scripts/src/deploy-cyclic-cross-worker.ts`** as each package’s **`deploy`** (see starter **`processor-do`** / **`coordinator-do`**). It **`wrangler deploy --dry-run`**s both sides; **sacred** path = separate full deploys; else **phased** from **pipeline primary** (default: lex larger Worker name; env **`PIPELINE_PRIMARY_SCRIPT`** to override). Turbo should run **primary** before the other package’s **`deploy`**. **`pre-deploy`** only logs cycles via **`bootstrapCircularCrossScriptDOBindings`**.

**Naming pattern (forks):** Derive a short prefix from the project slug (e.g. `my-saas` → `my-saas-web`, `my-saas-example-do`, `my-saas-coordinator-do`, `my-saas-processor-do`). Rename **`apps/web/package.json`** `name` to match the web worker (e.g. `my-saas-web`) and update Turbo `--filter=` references. Update:

- Each file’s `"name"`.
- Every `"script_name"` value that referenced an old name.
- Keep **`name`** / **`class_name`** / **binding `name`** fields consistent with TypeScript class names (`ExampleDo`, `CoordinatorDo`, `ProcessorDo`) unless the user is also renaming classes (advanced).

**Queues:** In `durable-objects/coordinator-do/wrangler.jsonc` and `durable-objects/processor-do/wrangler.jsonc`, rename queue identifiers (`work-queue`, `work-queue-dlq`) to a project-specific prefix, e.g. `my-saas-work-queue`, `my-saas-work-queue-dlq`, so they do not collide with other accounts’ queues.

**D1:** If commented D1 blocks use example names, align `database_name` with the new project when you enable D1.

After edits: `bun run typegen` from the repo root.

## 3. Package names (`package.json`)

- **Root** [`package.json`](../../package.json): set `"name"` to the project slug (replaces `cf-multiworker-starter-kit`).
- **`apps/web/package.json`**: set `"name"` to match the web worker (e.g. `my-saas-web` if that matches `apps/web/wrangler.jsonc` `name`).
- **Each DO package** under `durable-objects/*/package.json`: align names with folders or team conventions.
- **`workspace:*` dependencies:** If you rename a workspace package (e.g. `example-do`), update every consumer (`apps/web/package.json`, other packages) and `bun install` from root.

## 4. README

Rewrite [`README.md`](../../README.md) for the **product**, not the template:

- Title, description, and setup (`bun install`, `bun run dev`).
- Remove or shorten “Use this template”, links to `https://github.com/firtoz/cf-multiworker-starter-kit`, and generic “Why use this starter kit” marketing unless the team wants to keep attribution.
- Keep useful sections: env vars, deploy (`bun run deploy`), scripts, CI, tech stack—as appropriate for the fork.

## 5. UI and meta copy

- [`apps/web/app/welcome/welcome.tsx`](../../apps/web/app/welcome/welcome.tsx) — page title and intro paragraph.
- [`apps/web/app/routes/home.tsx`](../../apps/web/app/routes/home.tsx) — `meta` title and description.
- [`apps/web/app/routes/queue.tsx`](../../apps/web/app/routes/queue.tsx) — `meta` title (`Work Queue - Multi-Worker Demo`) if the queue route remains.

## 6. CONTRIBUTING

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — replace `<your-repo>` with the real clone URL if present.

## 7. Optional: other references

- Search the repo for `cf-multiworker-starter-kit`, `cf-starter-web`, `cf-starter-*`, `github.com/firtoz/cf-multiworker-starter-kit`, and old worker names; update docs and comments.
- Nested READMEs under `apps/web`, `durable-objects/*`, `packages/*` if they still read like the default template or show wrong worker names.

## 8. Verification

From the repo root:

```bash
bun run typegen
bun run typecheck
bun run lint
bun run build
```

Fix any failures before considering initialization complete.
