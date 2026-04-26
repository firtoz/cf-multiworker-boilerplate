# Agent instructions

Short index for AI agents. **Details live in Cursor skills** (`.cursor/skills/*.md` — project-specific playbooks for this monorepo, not generic marketing) so this file stays maintainable.

## Read first (by task)

| Topic | Where |
| -------- | ------ |
| Fork gotchas, forms, D1, dev port, new DO packages | [.cursor/skills/cf-starter-gotchas/SKILL.md](.cursor/skills/cf-starter-gotchas/SKILL.md) |
| Root commands, typegen/lint cadence, deploy, checklist, `bun add` | [.cursor/skills/cf-starter-workflow/SKILL.md](.cursor/skills/cf-starter-workflow/SKILL.md) |
| Env files, `.env.local` / `.env.production`, secrets | [.cursor/skills/cf-workers-env-local/SKILL.md](.cursor/skills/cf-workers-env-local/SKILL.md) |
| Turbo tasks, `^`, cache, `inputs` | [.cursor/skills/turborepo/SKILL.md](.cursor/skills/turborepo/SKILL.md) |
| Web ↔ worker bindings, `apps/web/alchemy.run.ts` | [.cursor/skills/cf-web-alchemy-bindings/SKILL.md](.cursor/skills/cf-web-alchemy-bindings/SKILL.md) |
| Durable Object package layout, Hono, `workers/rpc` | [.cursor/skills/cf-durable-object-package/SKILL.md](.cursor/skills/cf-durable-object-package/SKILL.md) |
| `WorkerRef`, cross-worker types, root `dev`/`destroy` | [.cursor/skills/cf-worker-rpc-turbo/SKILL.md](.cursor/skills/cf-worker-rpc-turbo/SKILL.md) |
| React Router routes, `RoutePath`, loaders | [.cursor/skills/routing/SKILL.md](.cursor/skills/routing/SKILL.md) |
| `formAction`, `useDynamicSubmitter` | [.cursor/skills/form-submissions/SKILL.md](.cursor/skills/form-submissions/SKILL.md) |
| Rename / rebrand after using the template | [.cursor/skills/project-init/SKILL.md](.cursor/skills/project-init/SKILL.md) |
| React components: one per file, route wrappers | [.cursor/skills/component-organization/SKILL.md](.cursor/skills/component-organization/SKILL.md) |
| React patterns (callbacks, module constants) | [.cursor/skills/react-patterns/SKILL.md](.cursor/skills/react-patterns/SKILL.md) |
| Authoring or updating skills | [.cursor/skills/creating-skills/SKILL.md](.cursor/skills/creating-skills/SKILL.md) |

**Always-on reminder (workers, env, routes):** [.cursor/rules/cf-workers-patterns.mdc](.cursor/rules/cf-workers-patterns.mdc)

**Generated artifacts policy:** [.cursor/rules/generated-artifacts.mdc](.cursor/rules/generated-artifacts.mdc). Never hand-author Drizzle migration SQL, Drizzle `meta/*.json`, React Router `+types`, lockfiles, or `.alchemy/` output. Edit the source of truth and run the generator.

**When to offer project-init** (forks vs upstream starter kit): [.cursor/rules/project-init.mdc](.cursor/rules/project-init.mdc)

**Dev server policy (agents):** do not start long-running dev unless the user asked — [.cursor/rules/dev-server.mdc](.cursor/rules/dev-server.mdc)

## Cloud agents

**Mandatory setup:** [.cursor/rules/00-cloud-agent-mandatory.mdc](.cursor/rules/00-cloud-agent-mandatory.mdc)

If `bun` is missing in the agent environment:

```bash
cd /workspace && bash ./.cursor/setup-agent.sh && source ~/.bashrc
```

Setup is normally applied via `.cursor/environment.json`.

## One-liner defaults

- Bindings in app code: `import { env } from "cloudflare:workers"` (not React Router `context.cloudflare.env`).
- Drizzle migrations: edit `packages/db/src/schema.ts` or `durable-objects/<name>/src/schema.ts`, then run `bun run db:generate` or the package-local `db:generate`. Do not write SQL/meta snapshots by hand.
- Maintenance loop: run the narrowest useful check frequently (`bun run typegen` after routes/env/Alchemy, `bun run typecheck` after TypeScript/API edits, `bun run lint` before finishing) from the **repo root**. Full checklist: [cf-starter-workflow](.cursor/skills/cf-starter-workflow/SKILL.md).

## Creating new skills

When a pattern repeats or `AGENTS.md` would grow again, add a skill: [.cursor/skills/creating-skills/SKILL.md](.cursor/skills/creating-skills/SKILL.md).
