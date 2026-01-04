# Contributing Guide

Thank you for contributing to this project! This guide will help you get started.

## Development Setup

1. **Install Bun** (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone and install dependencies**:
   ```bash
   git clone <your-repo>
   cd <your-repo>
   bun install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

4. **Start development server**:
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
│   ├── do-common/        # Shared types and schemas
│   └── scripts/          # Build and deployment scripts
└── turbo/generators/     # Code generators
```

## Adding a New Durable Object

```bash
bunx turbo gen durable-object
```

Follow the prompts and the generator will:
- Create the DO structure
- Set up wrangler config
- Configure TypeScript
- Add Biome config

After generation:
1. Add DO binding to `apps/web/wrangler.jsonc`
2. Run `bun run typegen` to update types
3. Implement your DO logic in `workers/app.ts`

## Testing

Before submitting a PR:

1. **Type check**: `bun run typecheck`
2. **Lint**: `bun run lint`
3. **Build**: `bun run build`
4. **Test locally**: `bun run dev`

## Dependency Management

- **Adding dependencies**: Use `bun add <package>`
- **Updating dependencies**: Use `bun run update:interactive`
- **Security audit**: Run `bun run audit` regularly
- **Check outdated**: Use `bun run outdated`

### Dependency Guidelines
- Prefer well-maintained packages with active communities
- Check bundle size impact before adding new dependencies
- Use workspace protocol (`workspace:*`) for internal packages
- Keep dependencies up to date with Renovate bot

## Performance Considerations

### Bundle Size
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
6. **Wait for CI** to pass (lint, typecheck, build, audit)
7. **Address review feedback** if any

## Questions?

- Check existing issues and discussions
- Review the main README.md
- Ask in discussions for general questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
