---
name: project-init
description: Personalizes a fork of this Cloudflare multi-worker monorepo—worker names in wrangler, package names, README, and UI—so deploys and docs are not stuck on starter kit defaults. Use when the user created a repo from the template, wants to deploy their own app, or asks to rename workers, rebrand, or remove generic starter kit copy. Skip when developing the upstream starter kit (origin URL contains firtoz/cf-multiworker-starter-kit; canonical https://github.com/firtoz/cf-multiworker-starter-kit) unless the user explicitly asks.
---

# Project initialization (personalize your fork)

Use this skill when someone is building **their** app on top of this starter kit—not when maintaining the upstream repo at [https://github.com/firtoz/cf-multiworker-starter-kit](https://github.com/firtoz/cf-multiworker-starter-kit).

**Guard:** If `git remote get-url origin` contains `firtoz/cf-multiworker-starter-kit`, do **not** run this flow unless the user explicitly requests renaming or templating work.

**Note:** Root [AGENTS.md](../../AGENTS.md) describes package-local **`alchemy.run.ts`** files as the infra source of truth. For forks, rename package IDs / stable worker script names and bindings in those package apps. Run **`bun run typegen`** after changes.

## 1. Gather information

Ask the user (or infer from context):

- **Project slug** — npm-safe name, e.g. `my-saas-app` (used for root `package.json` `name` and naming).
- **One-line description** — for README, meta tags, and home hero copy.
- **Chatroom DO** — `durable-objects/chatroom-do` (WebSocket / Socka + DO SQLite) is wired from `apps/web` as `ChatroomDo`; rename script + `CHATROOM_DO_WORKER_NAME` in fork flows.
- **D1** — `packages/db` + `D1_DATABASE_NAME` / optional `D1_DATABASE_ID` in **`.env.local`** / **`.env.production`**; run migrations after renames.

## 2. Alchemy worker names and cross-script Durable Objects

Each package **`alchemy.run.ts`** defines script names, Durable Objects, service refs, and imports. Cross-package resources are exported through package **`"./alchemy"`** exports and imported by consumers.

| Resource (default) | Role |
|--------------------|------|
| `durable-objects/chatroom-do/alchemy.run.ts` | Exports **`ChatroomDo`** with same-script DO + SQLite |
| `apps/web/alchemy.run.ts` | SSR app; **`ChatroomDo`** / **`PingDo`** are imported from package **`./alchemy`** exports |

**Naming pattern (forks):** Derive a short prefix from the project slug (e.g. `my-saas` → package id `my-saas-chatroom-do`, web id `my-saas-web`). Use stable worker `name` values in package Alchemy apps when other workers refer to a script through `WorkerRef`. Keep **`className: "ChatroomDo"`** consistent with the exported DO class unless you rename the class in TypeScript (advanced).

**Cross-script DO caveat:** Consumers import provider resources from package **`./alchemy`** exports. Migrations belong on the worker script that **defines** the class (`sqlite: true` on that **`DurableObjectNamespace`** where applicable).

**D1:** `D1Database("main-db", { migrationsDir: … })` in **`apps/web/alchemy.run.ts`** points at **`packages/db/drizzle`**. After schema changes, run **`bun run db:generate`**; deploy uses **`bun run deploy`** / Turbo per Alchemy’s D1 flow.

After edits: **`bun run typegen`** from the repo root. `env.d.ts` follows exported package worker resources.

## 3. Package names (`package.json`)

- **Root** [`package.json`](../../package.json): set `"name"` to the project slug (replaces `cf-multiworker-starter-kit`).
- **`apps/web/package.json`**: set `"name"` to match your web package naming (e.g. `my-saas-web`); align **`ReactRouter(...)`** first argument in **`alchemy.run.ts`** with the script name you want in Cloudflare.
- **Each DO package** under `durable-objects/*/package.json`: align names with folders or team conventions.
- **`workspace:*` dependencies:** If you rename a workspace package (e.g. `chatroom-do`), update every consumer (`apps/web/package.json`, other packages) and `bun install` from root.

## 4. README

Rewrite [`README.md`](../../README.md) for the **product**, not the template:

- Title, description, and setup (`bun install`, `bun run dev`).
- Remove or shorten “Use this template”, links to `https://github.com/firtoz/cf-multiworker-starter-kit`, and generic “Why use this starter kit” marketing unless the team wants to keep attribution.
- Keep useful sections: env vars, deploy (`bun run deploy`), scripts, CI, tech stack—as appropriate for the fork.

## 5. UI and meta copy

- [`apps/web/app/welcome/welcome.tsx`](../../apps/web/app/welcome/welcome.tsx) — page title and intro paragraph.
- [`apps/web/app/routes/home.tsx`](../../apps/web/app/routes/home.tsx) — `meta` title and description.
- [`apps/web/app/routes/chat.tsx`](../../apps/web/app/routes/chat.tsx) — `meta` title if you keep the chat demo.

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
