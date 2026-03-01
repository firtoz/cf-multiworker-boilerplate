# Cursor Configuration

This directory contains configuration and rules for Cursor IDE and Cloud Agents.

## For Cloud Agents - START HERE

**READ THIS FIRST:** [rules/00-cloud-agent-mandatory.mdc](./rules/00-cloud-agent-mandatory.mdc)

### Automatic Setup

Setup runs automatically via `environment.json`:

```json
{
  "install": "bash ./.cursor/setup-agent.sh"
}
```

This ensures bun and dependencies are installed on VM startup.

### If Setup Didn't Run

Manually execute:
```bash
cd /workspace && bash ./.cursor/setup-agent.sh && source ~/.bashrc
```

See [cloud-agent-setup.mdc](./rules/cloud-agent-setup.mdc) for detailed documentation.

## Directory Structure

- `environment.json` - Cloud Agent runtime configuration
  - Configures automatic setup on VM startup
  - See [Cursor docs](https://cursor.com/docs/cloud-agent#the-environmentjson-spec)

- `setup-agent.sh` - Environment setup script
  - Installs bun
  - Installs project dependencies
  - Runs automatically via `environment.json`

- `rules/` - Workspace rules that agents should follow
  - `00-cloud-agent-mandatory.mdc` - Critical startup guide (00- prefix = read first)
  - `cloud-agent-setup.mdc` - Detailed setup documentation
  - `dev-server.mdc` - Policy about not running long-lived dev servers
  - `git-workflow.mdc` - Git workflow policy (always use PRs, not direct pushes)
  - `git-completion-reminder.mdc` - Reminder to commit and push before ending (Cloud Agents)

- `skills/` - Reusable skills and patterns
  - Auto-discovered based on the task at hand
  - Contains coding patterns and guidelines

## Adding New Rules

Rules in `rules/` directory are automatically loaded as workspace rules.

## Adding New Skills

See `.cursor/skills/creating-skills/SKILL.md` for guidance on creating new skills.
