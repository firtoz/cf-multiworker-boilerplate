# Cloudflare Multi-Worker Starter Kit

Production-proven Turborepo monorepo starter kit for full-stack Cloudflare Workers apps — Durable Objects, end-to-end type safety, and a battle-tested deploy pipeline.

## Why Use This?

Building on Cloudflare's edge platform is powerful but complex. This starter kit solves the hard parts so you can focus on your app:

- **Type Safety Across Workers**: Automatic type generation for Durable Object bindings - call DOs from any worker with full IntelliSense
- **Modern React Stack**: React Router 7 with streaming SSR, form actions, and optimized CSS loading via 103 Early Hints
- **End-to-End Validation**: Type-safe API calls using Hono + hono-fetcher with Zod validation
- **Ready to Deploy**: Turborepo tasks for local vs prod typegen/wrangler, **dry-run deploy** vs **live deploy**, and aggressive caching (only `dev` and `clean` skip the Turbo cache)

**What's included:**
- React Router 7 web app with TailwindCSS
- Multiple Durable Object examples with different communication patterns (direct RPC)
- Turborepo generator to scaffold new Durable Objects
- Automatic type imports via unified cf-typegen script

## Quick Start

### Use This Template

**Option 1 - GitHub UI:**
1. Go to [github.com/firtoz/cf-multiworker-starter-kit](https://github.com/firtoz/cf-multiworker-starter-kit)
2. Click "Use this template" → "Create a new repository"

**Option 2 - GitHub CLI:**
```bash
gh repo create my-project --template firtoz/cf-multiworker-starter-kit --public
cd my-project
```

### Install & run

```bash
bun install

# Interactive .env.local (prompts for SESSION_SECRET, optional Cloudflare token/account; won't overwrite unless --force)
bun run setup

# Dev (Turbo runs typegen → wrangler generate → Vite; first run can take a minute)
bun run dev
```

Open the URL Vite prints (usually `http://localhost:5173`; if that port is busy it picks the next, e.g. `5174`)

**Flags:** **`bun run setup --yes`** skips prompts (random **`SESSION_SECRET`**, placeholders for deploy; use when stdin is not a TTY). If **`.env.local` already exists** and you run **`setup` interactively**, you get a **summary** and can **update one section** (secret, demo string, Cloudflare, worker names) or re-run the full wizard. **`bun run setup --force`** replaces the file (after confirm in a TTY; **`--yes --force`** for scripts). **If you skip `setup`:** a real **`SESSION_SECRET`** avoids session surprises. **Before deploy**, set **`CLOUDFLARE_*`** or use **`setup`** again.

**After forking:** **`bun run setup`** can set a **prefix for local Wrangler worker script names** (the `*-dev` workers). For production names, `package.json` names, README/UI, and a full rebrand, see [.cursor/skills/project-init/SKILL.md](.cursor/skills/project-init/SKILL.md).

### Conventions (humans & AI coding agents)

Skim [AGENTS.md](AGENTS.md) at the repo root. In short:

- **Cloudflare `env`:** `import { env } from "cloudflare:workers";` — do not use React Router context (e.g. `context.cloudflare.env`) for bindings.
- **New routes:** register in `apps/web/app/routes.ts`, run `bun run typegen`, and in each route module export `route` with `RoutePath<"...">` from `@firtoz/router-toolkit` (see `apps/web/app/routes/home.tsx`).
- **While building:** run `bun run typegen`, `bun run typecheck`, and `bun run lint` from the repo root whenever you change routes, wrangler, or env — not only at the end.
- **Loaders / actions:** prefer `Promise<MaybeError<...>>` with `success` / `fail` so UI and submitters narrow cleanly (see `apps/web/app/routes/home.tsx`).

## Project Structure

```
├── apps/
│   └── web/                    # React Router 7 app
│       ├── app/routes/         # Routes (home.tsx, ...)
│       └── workers/app.ts      # Cloudflare Worker entry point
├── durable-objects/
│   ├── coordinator-do/         # Orchestrates work across workers
│   ├── processor-do/           # Processes work items
│   └── example-do/             # Minimal DO example
└── packages/
    ├── do-common/              # Shared types & Zod schemas
    └── scripts/                # Shared tooling
        ├── src/cf-typegen.ts   # Wrangler types across workspace packages
        ├── src/pre-deploy.ts   # Pre-deploy checks (used by deploy:execute)
        ├── src/utils/generate-wrangler.ts  # wrangler.jsonc.hbs → wrangler-dev | wrangler-prod
        └── src/wrangler-dry-run-prod.ts    # wrangler deploy --dry-run (used by deploy)
```

For deeper conventions (env files, `^task` dependencies, caching), see **[AGENTS.md](AGENTS.md)** and [.cursor/skills/turborepo/SKILL.md](.cursor/skills/turborepo/SKILL.md).

## Key Features

### 1. Type-Safe Durable Object Calls

The `cf-typegen` script automatically runs wrangler types and converts DO type comments into proper imports:

```typescript
// After running cf-typegen, you get full types:
const coordinator = env.CoordinatorDo.getByName("main");
const api = honoDoFetcherWithName(env.CoordinatorDo, "main");
const response = await api.get({ url: "/status" }); // ✅ Typed!
```

### 2. Add New Durable Objects Easily

```bash
bunx turbo gen durable-object
# Follow prompts, then implement logic in workers/app.ts
```

## Configuration

### Environment variables

- **`.env.example`** (committed) — **Documentation only.** No script reads it; copy values into real env files.
- **`.env.local`** (gitignored) — Local dev, `cf-typegen`, and `bun --env-file` for builds.
- **`.env.production`** (gitignored) — Production deploy: Cloudflare credentials, optional `ROUTES` / worker name overrides. `generate-wrangler --mode=remote` merges only keys listed in **`DEPLOYMENT_KEYS`** in `packages/scripts/src/utils/generate-wrangler.ts` (not the whole file dumped on top of `process.env`).

Minimal root `.env.local`:

```bash
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
SESSION_SECRET=random_secret_here
```

### Wrangler config (templates + generated JSONC)

Each app/DO package keeps a committed **`wrangler.jsonc.hbs`**. Generated files **`wrangler-dev.jsonc`** and **`wrangler-prod.jsonc`** are **gitignored** — produce them with `bun run typegen` (or per-package `generate-wrangler:local` / `:prod`). Do not hand-edit the generated JSONC.

To bind a Durable Object from another worker, use `script_name` in the template (see `durable-objects/*/wrangler.jsonc.hbs` and `apps/web/wrangler.jsonc.hbs`). Default worker names use a `*-dev` suffix locally and non-suffixed names for prod unless you override in `.env.local` / `.env.production` / CI.

Then run **`bun run typegen`** from the repo root so `worker-configuration.d.ts` stays in sync everywhere.

## Continuous Integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes and PRs to **`main`**:

1. **Lint** — `bun run lint` (Biome)
2. **Typecheck** — `bun run typegen` then `bun run typecheck`
3. **Build** — `bun run build`

Uses Bun with a frozen lockfile and Turborepo for parallel/cached tasks.

## Deployment

### Prerequisites

1. **API token** — https://dash.cloudflare.com/profile/api-tokens → **Edit Cloudflare Workers** (or equivalent: Workers Scripts, Workers Routes, Observability).
2. **Root env** — put `CLOUDFLARE_API_TOKEN` (and usually `CLOUDFLARE_ACCOUNT_ID`) in **`.env.local`** for local CLI. For production wrangler generation, use **`.env.production`** as described in [AGENTS.md](AGENTS.md).

### Two commands: dry-run vs live

| Command | What it does |
|--------|----------------|
| **`bun run deploy`** | After **`cf-web-app#build:prod`**, runs **`wrangler deploy --dry-run`** for each DO (`wrangler-prod.jsonc`) and the web app (`build/server/wrangler.json`). **No uploads**. |
| **`bun run deploy:execute`** | Runs **`pre-deploy`** checks, **`build:prod`**, **live `wrangler deploy`** for workspace DOs (order respects cross-worker DO bindings), then deploys the web worker from the production build. |

Use **`deploy`** in CI or locally to verify bundles/config without changing Cloudflare state. Use **`deploy:execute`** when you intend to ship.

**Turbo tip:** Most tasks are cached when inputs are unchanged. Only **`dev`** and **`clean`** always skip cache. To force a fresh run (e.g. redeploy same tree), use `turbo run deploy:execute --filter=cf-web-app --force`.

**If live deploy fails** with errors about bindings to another worker script: ensure dependent workers are deployed first (this repo's Turbo graph orders processor before coordinator where required). See [AGENTS.md](AGENTS.md) deploy section.

## Scripts

### Development
- `bun run dev` — Dev servers (Turbo; **`cache: false`**, long-running)
- `bun run build` — `turbo run build:local`
- `bun run typecheck` — `typecheck:local` across packages
- `bun run typecheck:prod` — Prod-shaped types/config
- `bun run typegen` / `typegen:local` — Generate Wrangler types + React Router route types
- `bun run typegen:prod` — Prod wrangler inputs + types
- `bun run lint` — Biome (`check --write`)

### Deployment
- `bun run deploy` — **Dry-run only** (see table above)
- `bun run deploy:execute` — **Live** deploy pipeline

### Dependency management
- `bun run outdated` — Outdated deps across workspaces
- `bun run update:interactive` — Interactive updates
- `bun run clean` — Remove `node_modules` and build artifacts (**Turbo `clean`**)

### Code generation
- `bunx turbo gen durable-object` — Scaffold a new Durable Object package

## Best Practices & Optimizations

This starter kit follows modern 2026 best practices:

### Type safety
- **Shared TypeScript config**: `tsconfig.base.json` across packages
- **Strict TypeScript**: Additional checks where enabled (`noUncheckedIndexedAccess`, etc.)
- **Automatic generation**: `worker-configuration.d.ts` from Wrangler; React Router types under `.react-router/` (gitignored)

### Code quality
- **Biome** for lint + format
- **Turborepo**: Declared `inputs` / `outputs` / `env` so unchanged work **hits the cache** on repeat runs (except `dev` and `clean`)

### Git hooks
If you use pre-commit hooks in your fork, wire them to `bun run lint` / `typecheck` as you prefer — this template does not enforce a specific hook framework.

### Performance
- **103 Early Hints**: CSS preloading for faster initial page loads
- **Smart Placement**: Workers automatically deployed to optimal global locations
- **Aggressive Code Splitting**: Vendor chunks split for better caching
- **Streaming SSR**: React Router 7 streams HTML for faster TTFB

### Dependency management
- **Lock file**: `bun.lock` for reproducible installs
- Optional: add Renovate or Dependabot in your fork for automated bumps

### Observability
- **Cloudflare Logs**: Enabled for all workers and DOs
- **CPU Limits**: Configured to catch runaway executions early
- **Observability Dashboard**: View real-time metrics in Cloudflare dashboard

## Technologies

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Edge runtime
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** - Stateful serverless
- **[React Router 7](https://reactrouter.com/)** - Full-stack React framework
- **[Hono](https://hono.dev/)** - Fast web framework for Workers
- **[@firtoz/hono-fetcher](https://www.npmjs.com/package/@firtoz/hono-fetcher)** - Type-safe DO API client
- **[Zod](https://zod.dev/)** - Schema validation
- **[Turborepo](https://turbo.build/repo)** - Monorepo build system
- **[Biome](https://biomejs.dev/)** - Fast linter & formatter
- **[Bun](https://bun.sh/)** - Fast package manager & runtime

## License

MIT
