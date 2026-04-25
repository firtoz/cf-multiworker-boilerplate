---
name: cf-workers-env-local
description: Alchemy + env files — repo-root `.env.local` (dev) and `.env.production` (deploy/CI), optional per-package `.env.local`, and package-local Alchemy apps. Use when adding secrets or non-secret vars, debugging missing env in local dev, or local vs prod typegen. Never use a plain `.env` file. `.env.example` is human documentation only — no script reads it for all keys.
---

# Alchemy — env files and package apps

## When to use this skill

- Adding, renaming, or documenting environment variables for the web worker, chatroom worker, or D1.
- Local dev shows missing vars for Alchemy / Wrangler.
- Choosing **local** (`typegen:local` / `typecheck:local`) vs **prod** (`typegen:prod` / `typecheck:prod`) for CI.
- Explaining **repo-root** `.env.local` + `.env.production` vs optional per-package `.env.local`.

## Ground rules

1. **`.env.example` (repo root, optional `apps/web/.env.example`)** — **Human documentation only** for most keys. Root **`bun run dev`** and package dev scripts read the real **`.env.local`**; Alchemy docs cover [Secrets](https://alchemy.run/providers/cloudflare/secret/) and [State](https://alchemy.run/concepts/state/).

2. **Real env** — Put dev values in **`.env.local`** (gitignored). Use **`.env.production`** for deploy/CI secrets and Cloudflare credentials as your pipeline expects. **Do not use a plain `.env` file.**

3. **Infra source of truth** — Package-local **`alchemy.run.ts`** files. Changing bindings means updating the relevant package app. `env.d.ts` files use the exported package worker resource's `Env`.

4. **Turbo graph** — Root **`bun run dev`**, **`bun run deploy`**, and **`bun run destroy`** run Turbo. Web dev uses **`alchemy dev --app web`**; worker dev scripts may use Wrangler for local service-binding discovery.

5. **Per-package `.env.local`** — Optional; include in Turbo **`inputs`** where a package’s tasks need it (e.g. chatroom-do). Never substitute **`.env.example`** for real values.

## Typical layout

```
.env.example              # documentation only
.env.local                # gitignored dev — loaded by root `bun run dev` / package dev scripts
.env.production           # gitignored prod / CI secrets as needed
alchemy/
  password.ts             # shared Alchemy encryption password fallback
apps/web/
  alchemy.run.ts                 # web Alchemy app
  env.d.ts                       # Alchemy-derived Env (see root AGENTS.md)
```

## Checklist after changing env or bindings

- Update **repo-root `.env.example`** so contributors know which keys exist.
- Update the relevant package **`alchemy.run.ts`**.
- Run **`bun run typegen`** from the **repo root**.
- For production parity: **`turbo run typegen:prod`** then **`turbo run typecheck:prod`** if prod env differs.

## Related docs

- Root [`AGENTS.md`](../../../AGENTS.md) — Environment variables, type generation, Alchemy entry.
- [`project-init`](../project-init/SKILL.md) — renaming resources after forking the template.
- [Alchemy Getting Started](https://alchemy.run/getting-started/) — `alchemy dev` / `deploy`, `alchemy login`.
