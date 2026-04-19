---
name: cf-workers-env-local
description: Wrangler env files — repo-root `.env.local` (dev) and `.env.production` (deploy), optional per-package `.env.local`, and generated wrangler JSONC. Use when adding secrets or non-secret vars, debugging missing env in wrangler dev, or local vs prod typegen. Never use a plain `.env` file. `.env.example` is human documentation only — no script reads it.
---

# Wrangler — env files and generated config

## When to use this skill

- Adding, renaming, or documenting environment variables for any Worker or Durable Object package.
- Local dev shows missing vars for `$VAR` substitution in generated Wrangler JSONC.
- Choosing **local** (`typegen:local` / `typecheck:local`) vs **prod** (`typegen:prod` / `typecheck:prod`) for CI or pre-deploy.
- Explaining **repo-root** `.env.local` + `.env.production` vs optional per-package `.env.local`.

## Ground rules

1. **`.env.example` (repo root, and optional `apps/web/.env.example`)** — **Human documentation only**. **No script reads it** — not setup, not Wrangler, not typegen. **`generate-wrangler`**, **`cf-typegen`**, and builds use real env files only.

2. **Real env** — **`generate-wrangler --mode=remote`** merges **only** keys in **`DEPLOYMENT_KEYS`** in `packages/scripts/src/utils/generate-wrangler.ts` from repo-root **`.env.production`** onto `process.env`. **`cf-typegen`** passes **`--env-file`** to Wrangler for repo-root **`.env.local`** / **`.env.production`**, and optionally per-package **`.env.local`** beside the package when present. **Do not use a plain `.env` file.**

3. **Generated Wrangler files** — Each worker package uses **`wrangler.jsonc.hbs`**. **`wrangler-dev.jsonc`** / **`wrangler-prod.jsonc`** are generated and gitignored. Edit the template and real env files, then run **`bun run typegen`** from the repo root.

4. **Per-package `.env.local`** — Optional; `cf-typegen` includes it if it exists next to that package (never `.env.example`).

5. **`cf-typegen`** — `packages/scripts/src/cf-typegen.ts`; requires `--apps-web-config=wrangler-dev.jsonc` or `wrangler-prod.jsonc`.

## Typical layout

```
.env.example              # documentation only (not read by tooling)
.env.local                # gitignored dev — read by cf-typegen / builds via --env-file
.env.production           # gitignored prod — deployment keys + generate-wrangler remote
apps/web/
  wrangler.jsonc.hbs
  wrangler-dev.jsonc
  wrangler-prod.jsonc
```

## Checklist after changing env or wrangler shape

- Update **repo-root `.env.example`** so contributors know which keys exist (documentation).
- If you change **`DEPLOYMENT_KEYS`**, add **`secrets.required`** in any **`wrangler.jsonc.hbs`**, or add prod-only deploy keys: update **`packages/scripts/src/utils/prod-env-manifest.ts`** (and prompts in **`bootstrap-env-prod.ts`**), **`sync-wrangler-secrets.ts`** / **`load-env-production.ts`** messages if needed, then **`bun run setup:prod`** smoke-test.
- Run **`bun run typegen`** from the **repo root**.
- For production parity before deploy: **`turbo run typegen:prod`** then **`turbo run typecheck:prod`**.

## Related docs

- Root [`AGENTS.md`](../../../AGENTS.md) — Environment variables, type generation, wrangler templates.
- [`project-init`](../project-init/SKILL.md) — renaming workers and packages after forking the template.
