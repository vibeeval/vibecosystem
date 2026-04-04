# Codex CLI Setup Guide

vibecosystem works with [Codex CLI](https://github.com/openai/codex) (OpenAI) in addition to Claude Code.

## Prerequisites

1. Node.js 18+
2. OpenAI API key
3. Codex CLI installed:

```bash
npm install -g @openai/codex
```

## Installation

### Option 1: Run the installer

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
./install-codex.sh
```

This copies all 274 skills to `~/.codex/skills/`.

### Option 2: Manual setup

```bash
# Clone the repo
git clone https://github.com/vibeeval/vibecosystem.git

# Copy skills
mkdir -p ~/.codex/skills
cp -r vibecosystem/skills/* ~/.codex/skills/

# Copy project instructions
cp vibecosystem/AGENTS.md ~/.codex/AGENTS.md
```

## Project Setup

To use vibecosystem in a specific project, copy `AGENTS.md` to your project root:

```bash
cp vibecosystem/AGENTS.md ~/my-project/AGENTS.md
```

Optionally, copy the Codex config:

```bash
mkdir -p ~/my-project/.codex
cp vibecosystem/.codex/config.toml ~/my-project/.codex/config.toml
```

## Usage

```bash
cd your-project
codex
```

Then use skills by referencing them:

```
> "use the coding-standards skill to review this file"
> "apply tdd-workflow to add a new feature"
> "use security-review to audit this endpoint"
> "follow postgres-patterns for this migration"
```

## What Works with Codex CLI

| Feature | Status | Notes |
|---------|--------|-------|
| Skills (SKILL.md) | Full support | Same format, auto-discovered |
| AGENTS.md | Full support | Project instructions |
| Agents | As skills | Single-agent model, agents = skill references |
| Hooks | Not supported | Codex CLI has different hook system |
| Rules | Via AGENTS.md | Key rules embedded in AGENTS.md |
| Self-learning | Not supported | Claude Code specific |
| Agent swarm | Not supported | Claude Code specific |

## Differences from Claude Code

1. **Single agent model**: Codex CLI runs one agent. vibecosystem agents are available as skills instead.
2. **No hooks**: Codex CLI has `hooks.json` but the format differs from Claude Code's `settings.json` hooks.
3. **No self-learning**: The instinct pipeline is Claude Code specific.
4. **No agent coordination**: Swarm, Dev-QA loop, and cross-training are Claude Code features.

## Updating

To update skills after a new vibecosystem release:

```bash
cd vibecosystem
git pull
./install-codex.sh --force
```

## Troubleshooting

### Skills not found
Make sure skills are in `~/.codex/skills/`:
```bash
ls ~/.codex/skills/ | head -20
```

### AGENTS.md not read
Check that `AGENTS.md` is in your project root or that `.codex/config.toml` has:
```toml
project_doc_fallback_filenames = ["AGENTS.md", "CLAUDE.md"]
```

### Wrong model
Edit `.codex/config.toml` in your project:
```toml
model = "o4-mini"  # or "gpt-4.1" or your preferred model
```
