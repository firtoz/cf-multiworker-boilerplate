# Agent Instructions

This file contains important guidelines for AI agents working on this codebase.

## Project initialization (forks)

If this repo is a **fork or template copy** that still has root `package.json` `"name": "cf-multiworker-boilerplate"` and the user wants their own app name, deployable worker names, and docs—follow the **project-init** skill: [.cursor/skills/project-init/SKILL.md](.cursor/skills/project-init/SKILL.md). The always-applied rule [.cursor/rules/project-init.mdc](.cursor/rules/project-init.mdc) explains when to offer this (and when **not** to, e.g. when working on the upstream boilerplate repo).

## For Cloud Agents

**If you're a Cloud Agent, read this first:** [.cursor/rules/00-cloud-agent-mandatory.mdc](.cursor/rules/00-cloud-agent-mandatory.mdc)

Setup runs automatically via `.cursor/environment.json`. If bun is not available:

```bash
cd /workspace && bash ./.cursor/setup-agent.sh && source ~/.bashrc
```

## Run From Repo Root

Always run build, typecheck, lint, and typegen from the workspace root. Turbo handles packages and task order.

```bash
bun run build
bun run typecheck
bun run lint
bun run typegen
```

## Package Installation

Install packages from the repo root. Use workspace filtering to add dependencies to a specific app:

```bash
bun add <package-name>@latest --filter apps/web
# or if filter doesn't work:
bun add <package-name>@latest --cwd apps/web
```

## Code Quality

### Always Check Lints After Editing

After making any changes to files, always run linter checks on the files you edited. You can use any lint tools you have first, and once you're done, also run:

```bash
bun run lint
```

Fix any linting errors before considering the task complete. This project uses Biome for linting and formatting.

## Worker Configuration

### Never Edit Worker Config Files by Hand

**DO NOT manually edit these files:**
- `worker-configuration.d.ts` (in any package)
- `wrangler.jsonc` bindings (unless you fully understand the implications)

These files are auto-generated or managed by automated scripts.

## Environment Variables

### Adding New Environment Variables

When adding new environment variables to any worker:

1. **Create or update `.env.local`** in the package directory with your development values:
   ```bash
   # .env.local
   MY_NEW_VAR=some_value
   ```

2. **Update `.env.example`** in the same package to document the variable for other developers:
   ```bash
   # .env.example
   # Description of what this variable does
   MY_NEW_VAR=example_value_here
   ```

3. **Run typegen** to update the worker configuration type definitions:
   ```bash
   bun run typegen
   ```

**What happens:**
- `.env.local` files are read by the build system and injected into the worker configuration
- This automatically updates `worker-configuration.d.ts` with proper TypeScript types
- You get full type safety for `env` variables in your worker code
- Other developers can reference `.env.example` to set up their own `.env.local`

**Important:**
- `.env.local` files are gitignored and never committed
- Always keep `.env.example` in sync with required variables
- Never commit secrets or API keys to `.env.example` - use placeholder values

## Type Generation

After making changes to worker configurations or environment variables, always run:

```bash
bun run typegen
```

This generates:
- Cloudflare Worker binding types (`worker-configuration.d.ts`)
- React Router route types (in the web app)
- Durable Object type imports

## Completion Checklist

Before considering the task complete:

- [ ] Lint passes: `bun run lint`
- [ ] Typecheck passes: `bun run typecheck`
- [ ] If you made code changes and you're a Cloud Agent: `git add`, `git commit`, `git push` (do not skip)
