# Codex CLI Setup Guide

vibecosystem works with [Codex CLI](https://github.com/openai/codex) (OpenAI) in addition to Claude Code.

## Prerequisites

1. Node.js 18+
2. A Codex account or API authentication method supported by your host installation
3. Python 3 for validating the luna worker contract
4. Codex CLI installed:

```bash
npm install -g @openai/codex
```

## Installation

### Recommended: use the installer

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem

# Small, operational core profile
./install-codex.sh --profile core

# Or install every top-level skill
./install-codex.sh --profile full

# Install the bounded luna worker as well
./install-codex.sh --profile core --install-luna-worker
```

Skills are installed into `~/.agents/skills/`, the current Codex skill discovery target. Normal installs update unchanged installer-owned files and reconcile unchanged owned files that are absent from the new profile. Modified and unmanaged destinations are preserved. The installer does not copy `AGENTS.md` to a global location; keep project instructions in the project where Codex runs.

The `core` profile is an explicit allowlist for a predictable, smaller installation. The `full` profile includes every top-level directory under `skills/`.

### Installer options

| Option | Behavior |
| --- | --- |
| `--profile core\|full` | Select the explicit core allowlist or all skills. Default: `core`. |
| `--install-luna-worker` | Validate and install `.codex/agents/luna-worker.toml` at `~/.codex/agents/luna-worker.toml`. |
| `--validate-luna-worker` | Validate the canonical worker contract and exit when used alone. |
| `--dry-run` | Print the planned changes without creating, replacing, pruning, or backing up user files. |
| `--prune` | Compatibility flag; normal installs already reconcile unchanged, recorded skills absent from the selected profile. |
| `--force` | Replace existing destinations, after taking a backup. Without it, modified or unmanaged destinations are preserved. |
| `--non-interactive` | Skip the confirmation prompt. |

The ownership manifest is `~/.agents/.vibecosystem-codex-skills`. Pruning never removes an unrecorded skill, a symlink, or a skill whose contents changed after installation. If no manifest exists, pruning reports that it has nothing safe to remove. Destructive changes are copied to a timestamped directory under `~/.agents/vibecosystem-backups/` first.

Preview a change before applying it:

```bash
./install-codex.sh --profile core --install-luna-worker --dry-run
```

Validate the canonical worker without touching the home directory:

```bash
./install-codex.sh --validate-luna-worker
```

### Manual setup

The installer is preferred because it preserves ownership boundaries and handles backups. For a manual full skill copy:

```bash
git clone https://github.com/vibeeval/vibecosystem.git
mkdir -p ~/.agents/skills
cp -r vibecosystem/skills/* ~/.agents/skills/
```

To install the worker manually:

```bash
mkdir -p ~/.codex/agents
cp vibecosystem/.codex/agents/luna-worker.toml ~/.codex/agents/luna-worker.toml
```

## Project setup

To use vibecosystem instructions in a specific project, copy `AGENTS.md` to that project root:

```bash
cp vibecosystem/AGENTS.md ~/my-project/AGENTS.md
```

Optionally, copy the model-neutral Codex project config:

```bash
mkdir -p ~/my-project/.codex
cp vibecosystem/.codex/config.toml ~/my-project/.codex/config.toml
```

The project config only defines the `AGENTS.md`/`CLAUDE.md` document fallback. It intentionally does not pin a project-wide model, enable `history.local`, or override skill discovery. For this repository, the canonical Codex worker is `.codex/agents/luna-worker.toml`: install it with `--install-luna-worker` so `gpt-5.6-luna` with `max` reasoning remains the single worker authority. Codex does not run the Claude Opus/Sonnet router.

## Usage

```bash
cd your-project
codex
```

Then use installed skills by referencing them:

```
> "use the coding-standards skill to review this file"
> "apply tdd-workflow to add a new feature"
> "use security-review to audit this endpoint"
> "follow postgres-patterns for this migration"
```

Model availability and custom-agent discovery depend on the installed Codex version and account. The installer validates the repository contract; it does not test provider access.

The custom worker is named `luna_worker` and is the bounded repository worker for implementation and verification. Its canonical contract pins `gpt-5.6-luna` with `max` reasoning while keeping the task boundary explicit.

## What works with Codex CLI

| Feature | Status | Notes |
| --- | --- | --- |
| Skills (`SKILL.md`) | Installed by this adapter | Installed under `~/.agents/skills/` and auto-discovered. |
| Project instructions | Project-scoped | `AGENTS.md`, with `CLAUDE.md` as the configured fallback. |
| Custom agents | Host-dependent | Standalone TOML files can be project-scoped under `.codex/agents/` or installed globally under `~/.codex/agents/`. |
| Hooks | Not changed here | Codex and Claude Code hook formats differ. |
| Rules | Via `AGENTS.md` | Keep project rules in project instructions. |

## Updating

```bash
cd vibecosystem
git pull --ff-only
./install-codex.sh --profile core --dry-run
./install-codex.sh --profile core
```

Update the worker explicitly when needed:

```bash
./install-codex.sh --validate-luna-worker --install-luna-worker --force
```

## Troubleshooting

### Skills not found

Check the current target:

```bash
find ~/.agents/skills -mindepth 1 -maxdepth 1 -type d | head -20
```

If an existing skill was preserved by merge mode, use `--force` after reviewing the backup behavior.

### Project instructions not read

Make sure `AGENTS.md` is in the project root, or check that `.codex/config.toml` contains:

```toml
project_doc_fallback_filenames = ["AGENTS.md", "CLAUDE.md"]
```

### Luna worker validation fails

Run:

```bash
./install-codex.sh --validate-luna-worker
```

The validator checks the exact name, description, bounded-worker instructions, model, and reasoning effort in `.codex/agents/luna-worker.toml`.

### Model selection

`.codex/config.toml` is deliberately model-neutral. The worker model authority lives in `.codex/agents/luna-worker.toml`; do not add `o4-mini`, tier routing, or model-changing hooks to the project config.

## Maintainer validation

Run the focused installer, ownership, prune, and TOML contract checks with:

```bash
tests/validate-codex-installer.sh
```
