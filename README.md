# Cloudflare Multi-Worker Boilerplate

Production-ready boilerplate for building full-stack React applications on Cloudflare Workers with Durable Objects, Queues, and end-to-end type safety.

## Why Use This?

Building on Cloudflare's edge platform is powerful but complex. This boilerplate solves the hard parts so you can focus on your app:

- **Type Safety Across Workers**: Automatic type generation for Durable Object bindings - call DOs from any worker with full IntelliSense
- **Queue-Based Architecture**: Working example of Cloudflare Queues for reliable, scalable task processing
- **Modern React Stack**: React Router 7 with streaming SSR, form actions, and optimized CSS loading via 103 Early Hints
- **End-to-End Validation**: Type-safe API calls using Hono + hono-fetcher with Zod validation
- **Ready to Deploy**: Pre-configured Turborepo with dev/build/deploy scripts that just work

**What's included:**
- React Router 7 web app with TailwindCSS
- Working queue demo (`/queue`) showing CoordinatorDo → Queue → ProcessorDo flow
- Multiple communication patterns (direct RPC + queue-based)
- Turborepo generator to scaffold new Durable Objects
- Automatic type imports via custom post-typegen script

## Quick Start

### Use This Template

**Option 1 - GitHub UI:**
1. Go to [github.com/firtoz/cf-multiworker-boilerplate](https://github.com/firtoz/cf-multiworker-boilerplate)
2. Click "Use this template" → "Create a new repository"

**Option 2 - GitHub CLI:**
```bash
gh repo create my-project --template firtoz/cf-multiworker-boilerplate --public
cd my-project
```

### Install & Run

```bash
# Install dependencies
bun install

# Start dev server (starts web app + all DOs)
bun run dev
```

Visit http://localhost:5173 to see the app, or http://localhost:5173/queue for the working queue demo.

## Project Structure

```
├── apps/
│   └── web/                    # React Router 7 app
│       ├── app/routes/         # Routes (home.tsx, queue.tsx)
│       └── workers/app.ts      # Cloudflare Worker entry point
├── durable-objects/
│   ├── coordinator-do/         # Orchestrates work, manages queue state
│   ├── processor-do/           # Processes work items
│   └── example-do/             # Minimal DO example
├── packages/
│   └── do-common/              # Shared types & Zod schemas
└── scripts/
    ├── post-typegen.ts         # Auto-fixes DO type imports
    └── predeploy.ts            # Pre-deployment checks
```

## Key Features

### 1. Type-Safe Durable Object Calls

The `post-typegen.ts` script automatically converts Wrangler's type comments into proper imports:

```typescript
// After running cf-typegen, you get full types:
const coordinator = env.CoordinatorDo.getByName("main");
const api = honoDoFetcherWithName(env.CoordinatorDo, "main");
const response = await api.get({ url: "/queue" }); // ✅ Typed!
```

### 2. Queue Demo

Visit `/queue` to see a complete implementation:
- Submit work with configurable delay
- Choose queue-based (reliable, scalable) or direct (faster) mode
- Watch items flow: pending → processing → completed
- Timestamps show exact timing through the system

### 3. Add New Durable Objects Easily

```bash
bunx turbo gen durable-object
# Follow prompts, then implement logic in workers/app.ts
```

## Configuration

### Environment Variables

Create `.env.local` in the root:

```bash
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
SESSION_SECRET=random_secret_here
```

### Wrangler Config

Each Durable Object has a `wrangler.jsonc`. To use a DO from another worker, add a binding:

```jsonc
// apps/web/wrangler.jsonc
"durable_objects": {
  "bindings": [
    {
      "name": "CoordinatorDo",
      "class_name": "CoordinatorDo",
      "script_name": "cf-coordinator-do"  // matches the DO's wrangler name
    }
  ]
}
```

Then run `bun run typegen` from root to update types across all packages.

## Deployment

```bash
bun run deploy
```

This runs `predeploy.ts` (type checks, builds) then deploys all workers + DOs to Cloudflare.

## Scripts

- `bun run dev` - Start all workers in dev mode
- `bun run build` - Build all packages
- `bun run deploy` - Deploy to Cloudflare
- `bun run typegen` - Generate types (Cloudflare + React Router)
- `bun run typecheck` - Type check all packages
- `bunx turbo gen durable-object` - Generate new DO

## Technologies

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Edge runtime
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** - Stateful serverless
- **[Cloudflare Queues](https://developers.cloudflare.com/queues/)** - Message queues
- **[React Router 7](https://reactrouter.com/)** - Full-stack React framework
- **[Hono](https://hono.dev/)** - Fast web framework for Workers
- **[@firtoz/hono-fetcher](https://www.npmjs.com/package/@firtoz/hono-fetcher)** - Type-safe DO API client
- **[Zod](https://zod.dev/)** - Schema validation
- **[Turborepo](https://turbo.build/repo)** - Monorepo build system
- **[Bun](https://bun.sh/)** - Fast package manager & runtime

## License

MIT
