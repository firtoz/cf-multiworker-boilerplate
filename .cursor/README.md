# Cursor configuration

Configuration and rules for Cursor IDE and Cloud Agents.

## For cloud agents — start here

**Read first:** [rules/00-cloud-agent-mandatory.mdc](./rules/00-cloud-agent-mandatory.mdc)

Setup should run through Cursor's saved Cloud Agent environment with install command `bash ./.cursor/setup-agent.sh`. If it did not run: `cd /workspace && bash ./.cursor/setup-agent.sh && source ~/.bashrc`. More detail and troubleshooting: [cloud-agent-setup.mdc](./rules/cloud-agent-setup.mdc).

## Directory structure

- **`setup-agent.sh`** — Installs Bun and runs `bun install` at repo root.
- **`rules/`** — Workspace rules (e.g. `00-cloud-agent-mandatory.mdc`, `cloud-agent-setup.mdc`, `dev-server.mdc`, `git-workflow.mdc`, `git-completion-reminder.mdc` points at git + mandatory docs).
- **`skills/`** — Project-specific playbooks under `.cursor/skills/`.

## Adding rules

Files in `rules/` are loaded as workspace rules.

## Adding skills

See [.cursor/skills/creating-skills/SKILL.md](./skills/creating-skills/SKILL.md).
