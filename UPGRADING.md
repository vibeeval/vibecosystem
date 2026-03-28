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

## Upgrading to v2.1

### New Skills (7)

| Skill | Category | What it does |
|-------|----------|-------------|
| minimax-pdf | Document | Professional PDF with 15 cover styles, token-based design system |
| minimax-docx | Document | Word documents via OpenXML SDK, create/edit/reformat pipelines |
| minimax-xlsx | Document | Excel with XML templates, financial formatting standards |
| pptx-generator | Document | PowerPoint with PptxGenJS, theme contracts, QA process |
| frontend-dev | Frontend | Design dials, anti-AI-aesthetic, motion engine, copywriting |
| fullstack-dev | Backend | 1,037-line guide, mandatory 5-step workflow, TS/Python/Go |
| clone-website | Tools | 5-phase website cloning, Chrome MCP, worktree isolation |

### New Agents (2)

| Agent | Codename | Purpose |
|-------|----------|---------|
| document-generator | DOCFORGE | Orchestrates PDF/DOCX/XLSX/PPTX generation |
| website-cloner | MIRAGE | Coordinates 5-phase pixel-perfect website cloning |

### No Breaking Changes
This is a purely additive release. No existing skills, agents, or hooks were modified.

### v2.0.0 (2026-03-26)

**Upgrading to v2.0**

**New Files** - Run the installer again or manually copy:

```bash
# Re-run installer (recommended)
cd vibecosystem && git pull && ./install.sh

# Or manually:
# 13 new agents
cp agents/{sast-scanner,mutation-tester,graph-analyst,mcp-manager,community-manager,benchmark,dependency-auditor,api-designer,incident-responder,data-modeler,test-architect,release-engineer,documentation-architect}.md ~/.claude/agents/

# 23 new skills
for skill in sast-patterns github-actions-integration mutation-testing code-knowledge-graph github-mcp browser-debugging n8n-workflows understand-codebase mcp-registry changelog-automation soc2-compliance gdpr-compliance hipaa-compliance prd-writer user-story-generator content-strategy cto-advisor vp-engineering product-analytics marketing-analytics developer-relations growth-engineering competitive-analysis; do
  cp -r skills/$skill ~/.claude/skills/
done

# 4 new hooks
cp hooks/{sast-on-edit,dashboard-ws-emitter,mcp-discovery,changelog-on-release}.ts ~/.claude/hooks/src/

# Dashboard (optional)
cp -r tools/dashboard ~/.claude/tools/
cd ~/.claude/tools/dashboard && npm install

# GitHub Actions (optional - copy to your project)
cp .github/workflows/claude-{review,fix}.yml YOUR_PROJECT/.github/workflows/
```

**Dashboard Setup:**
```bash
cd ~/.claude/tools/dashboard
npm install
npm start
# Open http://localhost:3848
```

**Hook Compilation** - After copying new hooks, rebuild:
```bash
cd ~/.claude/hooks && npm run build
```

**Breaking Changes:** None. v2.0 is fully backward compatible with v1.4.

### v1.4.0 (2026-03-25)

**New Agents (2):**
- `browser-agent` - AI browser automation via browser-use MCP: navigate, interact, extract, verify deploys, stealth toolkit (Patchright, Nodriver, Camoufox)
- `harvest` - Web intelligence gatherer: deep crawling, structured extraction, competitive analysis, social scraping toolkit (Katana, yt-dlp, gallery-dl)

**New Skills (9):**
- `browser-automation` - browser-use MCP integration for web interaction
- `harvest-single` - Single page smart extraction (`/harvest`)
- `harvest-deep-crawl` - Multi-page deep crawling (`/crawl`)
- `harvest-structured` - Structured data extraction with schemas (`/scrape`)
- `harvest-adaptive` - Adaptive content summarization (`/digest`)
- `harvest-monitor` - Web change monitoring and diff tracking
- `harvest-competitive` - Competitive intelligence gathering
- `config-security-scan` - Security scan for .claude/ configs (AgentShield pattern)
- `experiment-loop` - Autonomous optimization loop: modify, measure, keep/discard

**Enhanced Agents (2):**
- `security-reviewer` - Hard exclusion list (reduce false positives), diff-aware review mode (5-10x faster), confidence calibration
- `maestro` - Dynamic manager delegation, validation gate pattern, loop detection with step budgets, event-driven flow routing

**Enhanced Rules (2):**
- `qa-loop` - Event-driven conditional routing, output validation, auto-retry with error feedback (ModelRetry pattern)
- `agent-assignment-matrix` - New agent rows for browser automation, web crawling, config security, performance optimization loops

**New Infrastructure:**
- `docker/crawl4ai/docker-compose.yml` - crawl4ai web crawler (port 11235)
- `docs/mcp-integrations.md` - MCP server integration guide (browser-use, codebase-memory-mcp, crawl4ai)

**Inspired by:**
- [browser-use](https://github.com/browser-use/browser-use) (78K stars) - AI browser automation MCP
- [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) (780+ stars) - Persistent code knowledge graph
- [crawl4ai](https://github.com/unclecode/crawl4ai) (50K stars) - Deep web crawling + LLM extraction
- [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (50K stars) - AgentShield config scanner pattern
- [claude-code-security-review](https://github.com/anthropics/claude-code-security-review) - Hard exclusion list, diff-aware review
- [crewAI](https://github.com/crewAIInc/crewAI) (45.9K stars) - Dynamic delegation, event-driven flow
- [pydantic-ai](https://github.com/pydantic/pydantic-ai) (15.7K stars) - ModelRetry, structured output validation
- [karpathy/autoresearch](https://github.com/karpathy/autoresearch) (42K stars) - Autonomous experiment loop

### v1.3.0 (2026-03-24)

**New Skills (6):**
- `saas-payment-patterns` - Payment provider abstraction, webhook security, subscription lifecycle, dunning, pricing models
- `saas-auth-patterns` - Auth strategy matrix, multi-tenant auth, RBAC, API keys, MFA, session management
- `email-infrastructure` - SPF/DKIM/DMARC, subdomain strategy, provider abstraction, bounce handling, warmup
- `kvkk-compliance` - KVKK/GDPR comparison, consent management, right to erasure, data breach flow, audit logging
- `saas-analytics-patterns` - Event taxonomy, SaaS metrics (MRR/ARR/churn), funnel tracking, privacy-respecting analytics
- `saas-launch-checklist` - 28-item pre-launch checklist, day-1 monitoring, rollback plan, incident response skeleton

**Enhanced Skills (2):**
- `api-patterns` - Plan-based authorization, serverless rate limiting, API key authentication, usage metering
- `seo-patterns` - SaaS landing page anatomy, hero section formulas, pricing page SEO, SoftwareApplication schema

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
