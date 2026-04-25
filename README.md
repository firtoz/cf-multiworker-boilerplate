# Cloudflare Multi-Worker Starter Kit

[![GitHub: use this template](https://img.shields.io/badge/GitHub-use%20this%20template-24292e?logo=github)](https://github.com/firtoz/cf-multiworker-starter-kit/generate)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e)](https://github.com/firtoz/cf-multiworker-starter-kit/blob/main/README.md#license)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![Durable Objects](https://img.shields.io/badge/Durable%20Objects-1e293b?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/durable-objects/)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turbo&logoColor=white)](https://turbo.build/)
[![React Router](https://img.shields.io/badge/React%20Router-7-121212?logo=react&logoColor=61DAFB)](https://reactrouter.com/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=fff)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)](https://hono.dev/)

![Cloudflare Multi-worker Starter Kit — Monorepo for full-stack Cloudflare Workers & Durable Objects, type safety, ready to ship](docs/branding/banner.jpg)

Production-proven Turborepo monorepo starter kit for full-stack Cloudflare Workers apps — Durable Objects, end-to-end type safety, and a battle-tested deploy pipeline.

**Why this repo exists:** I ship several new projects a week and use this starter as my default stack—it keeps changing when real work surfaces gaps (env flows, deploy safety, typegen, monorepo ergonomics). If it saves you setup time, use it as a template or fork; if you want to tighten patterns for everyone, issues and pull requests are welcome—see [CONTRIBUTING.md](CONTRIBUTING.md).

<p align="center">
  <a href="https://peerlist.io/firtoz/project/cloudflare-multiworker-starter-kit" target="_blank" rel="noreferrer">
    <img
      src="https://peerlist.io/api/v1/projects/embed/PRJHA9E6LDQG9KQKD1AJB9M7OM6B7B?showUpvote=true&theme=dark"
      alt="Cloudflare Multi-Worker Starter Kit"
      height="72"
    />
  </a>
</p>

## Why Use This?

Building on Cloudflare's edge platform is powerful but complex. This starter kit solves the hard parts so you can focus on your app:

- **Type Safety Across Workers**: Automatic type generation for Durable Object bindings - call DOs from any worker with full IntelliSense
- **Modern React Stack**: React Router 7 with streaming SSR, form actions, and optimized CSS loading via 103 Early Hints
- **End-to-End Validation**: Type-safe API calls using Hono + hono-fetcher with Zod validation
- **Ready to Deploy**: **[Alchemy](https://alchemy.run/)** owns package-local dev/deploy/destroy apps; Turbo orders those apps from the repo root

**What's included:**
- React Router 7 web app with TailwindCSS
- **D1** + **Drizzle** in `packages/db` (site visit counter on `/visitors`) with migrations in-repo
- **Chat** sample: **`chatroom-do`** (WebSockets via **@firtoz/socka**, per-room Durable Object SQLite via Drizzle) and `/chat` in the web app
- Turborepo generator to scaffold new Durable Objects with package-local `alchemy.run.ts`
- **`env.d.ts`** per worker package: Alchemy `Env` inferred from exported package worker resources

## Quick Start

### Use This Template

**Option 1 - GitHub UI:**
1. Open [https://github.com/firtoz/cf-multiworker-starter-kit](https://github.com/firtoz/cf-multiworker-starter-kit)
2. Click "Use this template" → "Create a new repository"

**Option 2 - GitHub CLI:**
```bash
gh repo create my-project --template firtoz/cf-multiworker-starter-kit --public
cd my-project
```

### Install & run

```bash
bun install
```

**First-time Alchemy + Cloudflare (everyone on a new machine):**

1. **`bun alchemy configure`** — Create the **default** profile and connect **Cloudflare** (OAuth is fine; at “Customize scopes?” **No** is the usual choice).
2. **`bun alchemy login`** — Refreshes OAuth tokens when needed.
3. **Repo-root `.env.local`** (gitignored) — At minimum set **`SESSION_SECRET`** (strong random string). Optionally set **`CLOUDFLARE_API_TOKEN`** and **`CLOUDFLARE_ACCOUNT_ID`** instead of relying on the profile; see [Alchemy’s Cloudflare auth guide](https://alchemy.run/guides/cloudflare/).
4. **`ALCHEMY_PASSWORD`** — Optional for local dev: this repo uses a **documented dev default** in **`alchemy.run.ts`** so `alchemy.secret()` (e.g. **`SESSION_SECRET`** in state) can serialize. For **production, CI, or any shared/long-lived state**, set a **strong, stable** `ALCHEMY_PASSWORD` in `.env.local` / `.env.production` or your secret store. See [encryption password](https://alchemy.run/concepts/secret/#encryption-password).

Then:

```bash
# Loads .env.local; Turbo starts the web Alchemy dev session plus worker Wrangler dev sessions
bun run dev
```

Open the URL Vite/Alchemy prints (usually `http://localhost:5173`; if that port is busy it picks the next, e.g. `5174`). `bun run dev` runs `turbo run dev`, so the web package starts Alchemy dev and worker packages start local Wrangler sessions for direct service-binding smoke tests.

If you see **no Cloudflare credentials**, run **`bun alchemy configure`** / **`bun alchemy login`** or add **`CLOUDFLARE_API_TOKEN`** to `.env.local`. If you see **cannot serialize secret without password**, set **`ALCHEMY_PASSWORD`** or pull latest (a dev fallback password is set in **`alchemy.run.ts`**).

### Production deploy

From the repo root:

```bash
bun run deploy
```

which runs **`turbo run deploy`**. Each deployable package runs `alchemy deploy --app <package-id>` in dependency order. Use repo-root **`.env.production`** (or CI secrets) for **`SESSION_SECRET`**, **`CLOUDFLARE_*`**, **`ALCHEMY_PASSWORD`**, etc., as in **`.env.example`**. Read [Alchemy State](https://alchemy.run/concepts/state/) before wiring shared CI.

**After forking:** Rebrand docs/UI and choose stable worker names in each package’s **`alchemy.run.ts`** before first deploy — see [.cursor/skills/project-init/SKILL.md](.cursor/skills/project-init/SKILL.md).

### Build a real product from the starter

1. **Personalize** — rename the root package/app copy, update user-facing copy, and pick stable script names in package `alchemy.run.ts` files before your first production deploy.
2. **Add stateful features** — run `bunx turbo gen durable-object`, implement routes on the generated `readonly app`, then run `bun run dev`.
3. **Consume from web** — add the provider as a workspace dependency, import its `./alchemy` worker resource in `apps/web/alchemy.run.ts`, bind `providerWorker.bindings.YourDo`, then use `env.YourDo` or `honoDoFetcherWithName(env.YourDo, "name")` in loaders/actions.
4. **Add data** — update `packages/db/src/schema.ts`, run `bun run db:generate`, and let the web package Alchemy app manage D1.
5. **Ship** — set `.env.production` / CI secrets, set a stable `ALCHEMY_PASSWORD`, run `bun run typecheck`, `bun run lint`, `bun run build`, then `bun run deploy`.

### Conventions (humans & AI coding agents)

Skim [AGENTS.md](AGENTS.md) at the repo root. In short:

- **Cloudflare `env`:** `import { env } from "cloudflare:workers";` — do not use React Router context (e.g. `context.cloudflare.env`) for bindings.
- **New routes:** register in `apps/web/app/routes.ts`, run `bun run typegen`, and in each route module export `route` with `RoutePath<"...">` from `@firtoz/router-toolkit` (see `apps/web/app/routes/home.tsx`).
- **While building:** run `bun run typegen`, `bun run typecheck`, and `bun run lint` from the repo root whenever you change routes, **`alchemy.run.ts`**, **`env.d.ts`**, or env — not only at the end.
- **Loaders / actions:** prefer `Promise<MaybeError<...>>` with `success` / `fail` so UI and submitters narrow cleanly (see `apps/web/app/routes/home.tsx`).

## Project Structure

```
├── alchemy/                    # Shared Alchemy password helper
├── apps/
│   └── web/                    # React Router 7 app (D1 binding for site data)
│       ├── alchemy.run.ts      # Web Alchemy app and imported worker bindings
│       ├── app/routes/         # Routes (home, visitors, chat, …)
│       └── workers/app.ts      # Cloudflare Worker entry (SSR + /api/ws/* → chatroom DO)
├── durable-objects/
│   ├── chatroom-do/            # Multi-room WebSocket DO (Socka + DO SQLite)
│   ├── ping-do/                # Hono DO + service-binding example
│   └── other-worker/           # Plain worker service-binding example
└── packages/
    ├── db/                     # cf-starter-db — Drizzle + D1 schema/migrations
    ├── chat-contract/          # Shared Socka / chat types for web + DO
    └── scripts/                # Stub workspace package (historical name); infra lives in Alchemy
```

For deeper conventions (env files, `^task` dependencies, caching), see **[AGENTS.md](AGENTS.md)** and [.cursor/skills/turborepo/SKILL.md](.cursor/skills/turborepo/SKILL.md).

## Key Features

### 1. Type-Safe Durable Object Calls

Bindings are declared in each package’s **`alchemy.run.ts`** and flow into **`env.d.ts`** (see [AGENTS.md](AGENTS.md)). Use the Workers virtual module:

```typescript
import { env } from "cloudflare:workers";

const room = env.ChatroomDo.getByName("lobby");
// room.fetch(new Request("https://do/websocket", { method: "GET", headers: { Upgrade: "websocket" } }))
```

### 2. Add New Durable Objects Easily

```bash
bunx turbo gen durable-object
# Follow prompts, then implement logic in workers/app.ts
bun run dev
```

The generator creates a package-local `alchemy.run.ts`. To expose typed Hono routes, keep routes on the DO’s public `readonly app` and consume them with `honoDoFetcherWithName`.

## Configuration

### Environment variables

- **`.env.example`** (committed) — **Documentation** for humans/agents; Alchemy and other tools use real gitignored env files, not this file wholesale.
- **`.env.local`** (gitignored) — Loaded by Bun/root dev scripts. Set **`SESSION_SECRET`**, optional **`CLOUDFLARE_*`**, optional **`ALCHEMY_PASSWORD`** (see [Quick Start](#install--run)).
- **`.env.production`** (gitignored) — Use for **`bun run deploy`** / CI when you want prod-shaped values in a file.

After schema changes, run **`bun run db:generate`** so SQL lands in **`packages/db/drizzle/`**. The web package Alchemy app owns the **`D1Database`** for local dev and production deploy. The **`d1:migrate:*`** package scripts are informational.

## Continuous Integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes and PRs to **`main`**:

1. **Lint** — `bun run lint` (Biome)
2. **Typecheck** — `bun run typegen` then `bun run typecheck`
3. **Build** — `bun run build`

Uses Bun with a frozen lockfile and Turborepo for parallel/cached tasks.

## Deployment

Production is **`bun run deploy`** → **`turbo run deploy`**. Each deployable package runs **`alchemy deploy --app <package-id>`**. Use **`bun alchemy configure`** / **`bun alchemy login`** or **`CLOUDFLARE_API_TOKEN`** (and **`CLOUDFLARE_ACCOUNT_ID`** when needed) as in [Alchemy’s Cloudflare guide](https://alchemy.run/guides/cloudflare/). Set **`ALCHEMY_PASSWORD`** for real deployments and shared state so encrypted secrets in Alchemy state stay meaningful. See [AGENTS.md](AGENTS.md) and [State](https://alchemy.run/concepts/state/) for CI.

## Scripts

### Development
- `bun run dev` — `turbo run dev` (web Alchemy dev + worker Wrangler dev sessions)
- `bun run build` — `turbo run build:local`
- `bun run typecheck` — `typecheck:local` across packages
- `bun run typecheck:prod` — Prod-shaped types/config
- `bun run typegen` / `typegen:local` — React Router route types (+ workspace `typegen` chain)
- `bun run typegen:prod` — Prod env inputs for web `typegen:prod`
- `bun run lint` — Biome (`check --write`)
- `bun run d1:migrate:local` / `d1:migrate:remote` — No-ops that print how Alchemy applies D1 migrations (optional manual **`wrangler d1`** still possible)

### Deployment
- `bun run deploy` — `turbo run deploy`
- `bun run destroy` — `turbo run destroy`

### Dependency management
- `bun run outdated` — Outdated deps across workspaces (includes **Wrangler** via the workspace catalog where packages still use it)
- `bun update wrangler` — From the **repo root**, bumps **Wrangler** to the newest version allowed by **`workspaces.catalog.wrangler`** in root **`package.json`**; **`bun.lock`** pins the exact release
- `bun run update:interactive` — Interactive updates
- `bun run clean` — Remove `node_modules` and build artifacts (**Turbo `clean`**)

### Code generation
- `bunx turbo gen durable-object` — Scaffold a new Durable Object package
- `bun run db:generate` — Regenerate D1 / Drizzle SQL from `packages/db` schema (writes `packages/db/drizzle/`)

## Best Practices & Optimizations

This starter kit follows modern 2026 best practices:

### Type safety
- **Shared TypeScript config**: `tsconfig.base.json` across packages
- **Strict TypeScript**: Additional checks where enabled (`noUncheckedIndexedAccess`, etc.)
- **Types**: **`env.d.ts`** per worker package (Alchemy-derived; see [AGENTS.md](AGENTS.md)); React Router types under `.react-router/` (gitignored)

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

## Contributing

Bug reports, doc fixes, and improvements that keep the template honest for day-to-day use are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and quality checks before you open a PR.

## License

MIT
