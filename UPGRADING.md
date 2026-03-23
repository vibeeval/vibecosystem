# Upgrading vibecosystem

Guide for upgrading between vibecosystem versions.

## Quick Upgrade

```bash
cd vibecosystem
git pull origin main
./install.sh
```

## File Categories

### Safe to Overwrite

These files are maintained by vibecosystem and should be overwritten during upgrades:

| Path | Content |
|------|---------|
| `agents/*.md` | Agent definitions |
| `skills/*/prompt.md` | Skill prompts |
| `skills/*/SKILL.md` | Skill definitions |
| `hooks/src/*.ts` | Hook source code |
| `hooks/dist/*.mjs` | Compiled hooks |
| `rules/*.md` | Rule files (except user-created) |
| `install.sh` | Installer script |

### Merge Carefully

These files may contain user customizations:

| Path | Notes |
|------|-------|
| `~/.claude/settings.json` | User hook configuration, permissions |
| `~/.claude/CLAUDE.md` | May have project-specific additions |
| `~/.claude/rules/archive/*` | User's learned rules |

### Never Overwrite

These are user data, never touch:

| Path | Content |
|------|---------|
| `~/.claude/instincts.jsonl` | Learned patterns |
| `~/.claude/mature-instincts.json` | Consolidated patterns |
| `~/.claude/canavar/` | Agent performance data |
| `~/.claude/projects/` | Project-specific memory |
| `~/.claude/memory/` | Auto-memory files |

## Version History

### v1.2.0 (2026-03-24)

**New Skills (2):**
- `external-skills-catalog` - 60+ community skill directory with quality rankings and fallback strategy
- `pyxel-patterns` - Retro game engine patterns (game loop, sprites, MML audio, WASM deploy)

**Enhanced Skills (1):**
- `workflow-router` - Invisible routing principle, decision flowchart, fallback strategy chain

**Enhanced Rules (1):**
- `collaborative-decisions` - One-question rule (max 1 clarifying question)

**Fixed:**
- `a11y-expert.md` - Added missing YAML frontmatter
- `start-observer.sh` - Converted CRLF to LF line endings

**Inspired by:**
- [Skill Gateway](https://github.com/buraksu42/skill-gateway) - Invisible routing, external catalog, one-question rule
- [Pyxel](https://github.com/kitao/pyxel) - Retro game engine patterns, pixel art constraints, MML audio

### v1.1.0 (2026-03-22)

**New Skills (6):**
- `ui-ux-patterns` - 50+ named UX rules with numeric thresholds, UI style catalog
- `brand-identity` - Voice framework, visual identity, color management
- `reverse-document` - Generate docs from existing code (3 modes)
- `gate-check` - Phase transition validation with artifact checklists
- `design-system-generator` - 3-layer token architecture, Tailwind config
- `pentest-methodology` - 5-phase ethical security testing pipeline

**Enhanced Agents (5):**
- `designer` - Named UX rules, UI style catalog, industry anti-patterns, collaborative protocol
- `frontend-dev` - shadcn/ui best practices, performance budget, responsive breakpoints
- `accessibility-auditor` - Named a11y rules, platform references, automated testing scripts
- `technical-writer` - Incremental writing pattern, reverse documentation
- `security-analyst` - Pentest methodology, proof levels, taint tracing

**Enhanced Skills (4):**
- `coding-standards` - Result<T,E> pattern, timeless comments, function guidance
- `design-to-code` - 3-layer token architecture, dark mode strategy
- `frontend-patterns` - shadcn/ui, performance budget, React top 10
- `security` - Pentest overview, proof levels, taint tracing

**New Rules (3):**
- `pre-compact-state` - Session state preservation during context compression
- `incremental-writing` - Skeleton-fill-write pattern for long documents
- `collaborative-decisions` - Structured decision flow with AskUserQuestion

**Inspired by:**
- [Shannon](https://github.com/KeygraphHQ/Shannon) - Result<T,E>, pentest pipeline, comment philosophy
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max) - Named UX rules, UI style catalog, design tokens
- [Game Studios](https://github.com/Donchitos/game-studios) - Context resilience, incremental writing, gate checks

### v1.0.0 (2026-03-15)

Initial release: 119 agents, 202 skills, 48 hooks, 17 rules.
