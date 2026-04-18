---
name: cf-workers-env-local
description: Wrangler env files (.env.local, .env.production, optional per-package .env) and generated wrangler JSONC. Use when adding secrets or non-secret vars, debugging missing env in wrangler dev, local vs prod typegen, or choosing where API keys belong. `.env.example` is human/agent documentation only — no script reads it.
---

# Wrangler — env files and generated config

## When to use this skill

- Adding, renaming, or documenting environment variables for any Worker or Durable Object package.
- Local dev shows missing vars for `$VAR` substitution in generated Wrangler JSONC.
- Choosing **local** (`typegen:local` / `typecheck:local`) vs **prod** (`typegen:prod` / `typecheck:prod`) for CI or pre-deploy.
- Explaining **repo-root** `.env.local` + `.env.production` vs per-package `.env` / `.env.local`.

## Ground rules

1. **`.env.example` (repo root)** — **Documentation only** for humans and agents. Copy keys into `.env.local` / `.env.production`. **No tool** in this repo reads `.env.example` (not `generate-wrangler`, not `cf-typegen`, not builds).

2. **Real env** — **`generate-wrangler --mode=remote`** merges **only** keys in **`DEPLOYMENT_KEYS`** in `packages/scripts/src/utils/generate-wrangler.ts` from repo-root **`.env.production`** onto `process.env`. **`cf-typegen`** passes **`--env-file`** to Wrangler for **`.env.local`** / **`.env.production`** (and loads per-package **`.env`** / **`.env.local`** beside the package when present).

3. **Generated Wrangler files** — Each worker package uses **`wrangler.jsonc.hbs`**. **`wrangler-dev.jsonc`** / **`wrangler-prod.jsonc`** are generated and gitignored. Edit the template and real env files, then run **`bun run typegen`** from the repo root.

4. **Per-package `.env` / `.env.local`** — Optional; `cf-typegen` includes them if they exist next to that package (never `.env.example`).

5. **`cf-typegen`** — `packages/scripts/src/cf-typegen.ts`; requires `--apps-web-config=wrangler-dev.jsonc` or `wrangler-prod.jsonc`.

## Typical layout

```
.env.example              # documentation only (not loaded by scripts)
.env.local                # gitignored dev — read by cf-typegen / builds via --env-file
.env.production           # gitignored prod — deployment keys + generate-wrangler remote
apps/web/
  wrangler.jsonc.hbs
  wrangler-dev.jsonc
  wrangler-prod.jsonc
```

## Checklist after changing env or wrangler shape

- Update **repo-root `.env.example`** so contributors know which keys exist (documentation).
- Run **`bun run typegen`** from the **repo root**.
- For production parity before deploy: **`turbo run typegen:prod`** then **`turbo run typecheck:prod`**.

## Related docs

- Root [`AGENTS.md`](../../../AGENTS.md) — Environment variables, type generation, wrangler templates.
- [`project-init`](../project-init/SKILL.md) — renaming workers and packages after forking the template.
