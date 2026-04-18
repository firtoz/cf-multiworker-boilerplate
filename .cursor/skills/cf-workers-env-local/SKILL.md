---
name: cf-workers-env-local
description: Wrangler local environment files (.env and .env.local) in the multi-worker monorepo. Use when adding secrets or non-secret vars, debugging missing env in wrangler dev, explaining where API keys belong, or choosing between repo root and per-worker .env.local.
---

# Wrangler — `.env.local` in a multi-worker monorepo

## When to use this skill

- Adding, renaming, or documenting environment variables for any Worker or Durable Object package.
- The user or agent is unsure **which** `.env.local` file to edit (root vs `apps/web` vs `durable-objects/*`).
- Local dev shows missing required secrets from `wrangler.jsonc` → `secrets.required`.
- Migrating mental model from **`.dev.vars`** to **`.env.local`**.

## Ground rules

1. **Per-package directory** — For each deployable Worker, Wrangler loads dev variables from **`.env`** and **`.env.local` in the same directory as that package’s `wrangler.jsonc`** (not from the monorepo root by default). Paths are resolved relative to the config file’s folder.

2. **Repo root `.env.local`** — Still used for:
   - **`bun run deploy`** when the root script passes `--env-file ./.env.local` (e.g. `CLOUDFLARE_API_TOKEN`, `SESSION_SECRET`).
   - Scripts and tooling that explicitly read the root env file.
   It does **not** automatically inject into every child worker’s `env`; each worker package needs its own `.env.local` if it requires those bindings at dev time.

3. **No symlinks** — Do not symlink a root `.env.local` into `apps/web` or `durable-objects/*`. Prefer a real **`.env.local`** next to the relevant `wrangler.jsonc`, with the variables that worker declares (duplicate keys across files if both deploy and a DO need the same secret locally).

4. **`.dev.vars` vs `.env.local`** — Modern Wrangler supports loading from `.env` / `.env.local` in the config directory (see Wrangler’s local dev vars behavior). Prefer **`.env.local`** for new work and document it in that package’s **`.env.example`** / **`.env.local.example`**. Do not commit real secrets.

5. **`secrets` in `wrangler.jsonc`** — When using `secrets: { "required": ["MY_SECRET"] }`, Wrangler maps values from the loaded dev var files (and related rules) into typed `env.MY_SECRET` for local dev.

## Typical layout

```
.env.local                    # deploy / root tooling (e.g. CF token, session)
apps/web/
  wrangler.jsonc
  .env.local                  # optional: vars only for the web worker
durable-objects/<name>/
  wrangler.jsonc
  .env.local                  # secrets for this DO worker (e.g. provider API keys)
```

## Checklist after changing env

- Update the matching **`.env.example`** (placeholders only) in that package.
- Run **`bun run typegen`** from the **repo root** so `worker-configuration.d.ts` stays aligned (see root `AGENTS.md`).

## Related docs

- Root [`AGENTS.md`](../../../AGENTS.md) — “Environment Variables” and “Type Generation”.
- [`project-init`](../project-init/SKILL.md) — renaming workers and packages after forking the template.
