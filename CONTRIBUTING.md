# Contributing Guide

Thank you for contributing to this project! This guide will help you get started.

## Development Setup

1. **Install Bun** (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone and install dependencies** — clone the repository, `cd` into the working tree, then:

   ```bash
   bun install
   ```

3. **Environment** — after **`bun install`**, run **`bun run setup`** from the repo root to create or complete **`.env.local`** with **`SESSION_SECRET`** and **`ALCHEMY_PASSWORD`** (no in-repo defaults). For deploy-shaped files on disk, **`bun run setup:prod`**. **`.env.example`** is documentation only.
4. **Production deploy from your machine** — create **`.env.production`** (or maintain CI secrets), set a stable **`ALCHEMY_PASSWORD`**, then run **`bun run deploy`**. See root **README**, **[AGENTS.md](AGENTS.md)** (index), and **[.cursor/skills/cf-starter-workflow/SKILL.md](.cursor/skills/cf-starter-workflow/SKILL.md)**.

5. **Start development server**:
   ```bash
   bun run dev
   ```

## Code Quality Standards

### TypeScript
- Use **strict mode** with additional safety checks enabled
- Avoid `any` types - use `unknown` or proper types
- Prefer type inference over explicit types when obvious
- Use `satisfies` for better type checking

### Code Style
- We use **Biome** for linting and formatting
- Run `bun run lint` before committing
- Format on save is enabled in VS Code
- No console.log in production code (use proper logging)

### Commits
- Use semantic commit messages:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `refactor:` for code refactoring
  - `test:` for tests
  - `chore:` for maintenance

## Project Structure

```
├── apps/web/              # React Router 7 web app
├── durable-objects/       # Durable Object workers
├── packages/
│   ├── cf-starter-alchemy/  # Shared Alchemy password helper (import in alchemy.run.ts)
│   ├── db/                # D1 + Drizzle (cf-starter-db)
│   ├── chat-contract/     # Shared chat / Socka types
│   └── scripts/            # Workspace scripts package
└── turbo/generators/     # Code generators
```

## Adding a New Durable Object

```bash
bunx turbo gen durable-object
```

Follow the prompts and the generator will:
- Create the DO structure
- Create package-local `alchemy.run.ts`
- Configure TypeScript
- Add Biome config

After generation:
1. Implement routes/RPC on the generated class’s public **`readonly app`** in **`workers/app.ts`**.
2. If the web app consumes the DO, export the provider resource from the package **`./alchemy`** export, import it in **`apps/web/alchemy.run.ts`**, and add a **`workspace:*`** dependency in **`apps/web/package.json`** if Turbo should run that package’s checks before web.
3. Run **`bun run typegen`** and **`bun run typecheck`** from the repo root.

Root **`bun run deploy`** uses Turbo to deploy package Alchemy apps in dependency order.

## Testing

Before submitting a PR:

1. **Type check**: `bun run typecheck`
2. **Lint**: `bun run lint`
3. **Build**: `bun run build`
4. **Test locally**: `bun run dev`

## Dependency Management

- **Adding dependencies**: Use `bun add <package>`
- **Updating dependencies**: Use `bun run update:interactive`
- **Security**: Run `bun pm audit` or your registry’s audit workflow when upgrading deps
- **Check outdated**: Use `bun run outdated`

### Dependency Guidelines
- Prefer well-maintained packages with active communities
- Check bundle size impact before adding new dependencies
- Use workspace protocol (`workspace:*`) for internal packages
- Keep dependencies up to date with Renovate bot

## Deploy (from a contributor machine)

- **`bun run deploy`** — Runs **`turbo run deploy`**; deployable packages call **`alchemy deploy --app <package-id>`**. Requires production credentials and a stable **`ALCHEMY_PASSWORD`**.
- **`bun run destroy`** — Runs **`turbo run destroy`**. Turbo marks destroy/deploy uncached.

## Performance considerations

### Bundle size
- Monitor bundle size with the visualizer: `build/stats.html`
- Lazy load heavy components
- Use dynamic imports for large libraries

### Cloudflare Workers
- Keep Workers under 1MB after compression
- Use Durable Objects for stateful operations
- Leverage Smart Placement for optimal routing
- Set appropriate CPU limits to catch runaway code

## Pull Request Process

1. **Create a feature branch**: `git checkout -b feat/my-feature`
2. **Make your changes** following the code quality standards
3. **Test thoroughly** using the commands above
4. **Commit with semantic messages**
5. **Push and create a PR** with a clear description
6. **Wait for CI** to pass (lint, typecheck, build, etc.)
7. **Address review feedback** if any

## Questions?

- Check existing issues and discussions
- Review the main README.md
- Ask in discussions for general questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
