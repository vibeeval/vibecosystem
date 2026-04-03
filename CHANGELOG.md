# Changelog

All notable changes to vibecosystem will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Planned
- Public repo launch
- Community contribution workflow
- Skill marketplace
- Agent performance dashboard

## [2.2.0] - 2026-04-02

### Added
- **5 new features** reverse-engineered from Claude Code source:
  - **Agent Memory**: persistent per-agent memory with user/project/local scopes (agent-memory-loader, agent-memory-saver hooks)
  - **Magic Docs**: auto-updating docs via `# MAGIC DOC:` header detection (magic-doc-tracker, magic-doc-updater hooks)
  - **Dream Consolidation**: cross-session memory cleanup on 24h+3session threshold with lock mechanism (dream-consolidator hook)
  - **Smart Memory Recall**: frontmatter-based keyword+recency scoring for memory file selection (smart-memory-recall hook)
  - **Plugin Toggle**: CLI-based hook/skill enable/disable registry (plugin-registry hook + shared/plugin-check module)
- **7 new hooks**: agent-memory-loader, agent-memory-saver, magic-doc-tracker, magic-doc-updater, dream-consolidator, smart-memory-recall, plugin-registry
- **1 new shared module**: shared/plugin-check.ts (lightweight enable/disable checker)
- **Skill references** added to 21 agents (Recommended Skills sections)
- `memory: user` frontmatter field added to 10 core agents
- magic-docs/ directory with customizable prompt template
- plugin-config.json for hook/skill toggle state

### Sources
- [Claude Code source](https://github.com/anthropics/claude-code) — agentMemory.ts, MagicDocs, autoDream, findRelevantMemories, builtinPlugins

### Changed
- Updated counts: 137 agents, 269 skills, 60 hooks, 23 rules

## [2.1.2] - 2026-03-30

### Added
- **1 new agent**: paywall-planner (AI paywall strategy planner with category benchmarks, RevenueCat/Adapty config generation)
- **3 new skills**: paywall-strategy (15 category benchmarks, model selection), revenuecat-patterns (SDK integration for Swift/Kotlin/RN/Flutter), subscription-pricing (tier design, PPP, churn reduction)
- **6 new skills** adapted from Trail of Bits (4.1K stars): differential-review (blast radius, risk-adaptive depth), insecure-defaults (fail-open detection), variant-analysis (bug sibling hunting), sharp-edges (API footgun detection), fp-check (false positive verification), property-based-testing (PBT patterns for fast-check/Hypothesis/gopter)
- Dependency risk scoring merged into existing supply-chain-security skill
- RevenueCat and Trail of Bits added to Inspired By section

### Changed
- Updated counts across all files: 137 agents, 269 skills
- Regenerated gif1-numbers.gif with updated counts

## [2.1.1] - 2026-03-29

### Added
- **7 new skills** from oh-my-claudecode (14.6K stars) adaptation:
  - smart-model-routing: Dynamic model selection based on task complexity scoring
  - deep-interview: Socratic spec generation with ambiguity scoring (replaces discovery-interview)
  - agent-benchmark: Framework for measuring agent quality and detecting regressions
  - visual-verdict: Screenshot comparison QA with structured scoring
  - ai-slop-cleaner: Post-implementation cleanup with regression-safe passes
  - factcheck-guard: Runtime claim verification protocol
  - notepad-system: Compaction-resistant notes for context preservation
- **1 new rule**: commit-trailers (structured git trailers for decision context)

### Sources
- [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (14.6K stars)

## [2.1.0] - 2026-03-29

### Added
- **7 new skills**: minimax-pdf, minimax-docx, minimax-xlsx, pptx-generator, frontend-dev (MiniMax), fullstack-dev (MiniMax), clone-website
- **2 new agents**: document-generator (DOCFORGE), website-cloner (MIRAGE)
- **Document generation**: Professional PDF, Word, Excel, PowerPoint creation with anti-AI-aesthetic design system
- **Website cloning**: 5-phase pixel-perfect site cloning pipeline with Chrome MCP and git worktree isolation
- **Enhanced frontend patterns**: Design dials (variance, motion, density), anti-AI-aesthetic rules, motion engine
- **Enhanced fullstack patterns**: 1,037-line comprehensive guide with TypeScript, Python, and Go examples

### Sources
- [MiniMax-AI/skills](https://github.com/MiniMax-AI/skills) (6.8K stars) - document generation, frontend-dev, fullstack-dev
- [JCodesMore/ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) (1.9K stars) - clone-website

## [2.0.0] - 2026-03-26

### Added
- **13 new agents**: sast-scanner, mutation-tester, graph-analyst, mcp-manager, community-manager, benchmark, dependency-auditor, api-designer, incident-responder, data-modeler, test-architect, release-engineer, documentation-architect
- **23 new skills**: sast-patterns, github-actions-integration, mutation-testing, code-knowledge-graph, github-mcp, browser-debugging, n8n-workflows, understand-codebase, mcp-registry, changelog-automation, soc2-compliance, gdpr-compliance, hipaa-compliance, prd-writer, user-story-generator, content-strategy, cto-advisor, vp-engineering, product-analytics, marketing-analytics, developer-relations, growth-engineering, competitive-analysis
- **4 new hooks**: sast-on-edit (SAST security scan on edit), dashboard-ws-emitter (real-time agent monitoring), mcp-discovery (auto-suggest MCP servers), changelog-on-release (session changelog summary)
- **Agent Monitoring Dashboard**: Real-time web UI at localhost:3848 with agent timeline, live feed, Canavar error ledger, and agent breakdown stats
- **GitHub Actions CI/CD**: Automatic PR review (claude-review.yml) and issue-to-fix (claude-fix.yml) workflows using anthropics/claude-code-action
- **MCP Registry**: Python registry script with 12 known MCP servers and project-based recommendations
- **Compliance suite**: SOC2, GDPR, HIPAA compliance skills with checklists, code patterns, and audit guides
- **Product & Marketing skills**: PRD writer, user story generator, product analytics, marketing analytics, growth engineering, competitive analysis, content strategy, CTO advisor, VP engineering perspectives
- **Mutation testing**: Test suite quality measurement with Stryker/mutmut/go-mutesting support

### Changed
- Agent count: 121 -> 134
- Skill count: 223 -> 246
- Hook count: 49 -> 53

## [1.4.0] - 2026-03-25

### Added
- 2 new agents: browser-agent (AI browser automation + stealth toolkit), harvest (web intelligence gatherer)
- 9 new skills: browser-automation, harvest-single, harvest-deep-crawl, harvest-structured, harvest-adaptive, harvest-monitor, harvest-competitive, config-security-scan, experiment-loop
- Docker crawl4ai integration (docker/crawl4ai/docker-compose.yml)
- MCP integration guide (docs/mcp-integrations.md) for browser-use, codebase-memory-mcp, crawl4ai
- Stealth browser toolkit in browser-agent (Patchright, Nodriver, Camoufox, curl-impersonate)
- Advanced extraction toolkit in harvest (Katana, yt-dlp, gallery-dl, twscrape)

### Enhanced
- security-reviewer: hard exclusion list (reduce false positives), diff-aware review mode, confidence calibration
- maestro: dynamic manager delegation, validation gate pattern, loop detection + step budgets, event-driven flow routing
- qa-loop: event-driven conditional routing, output validation, auto-retry with error feedback (ModelRetry)
- agent-assignment-matrix: 7 new task categories for browser automation, web crawling, config security, performance loops

### Fixed
- README Turkce section agent count (119 -> 121)
- Docker compose deprecated version field removed
- browser-agent MCP tool list consistency across files

## [1.3.0] - 2026-03-24

### Added
- 6 new SaaS skills: saas-payment-patterns, saas-auth-patterns, email-infrastructure, kvkk-compliance, saas-analytics-patterns, saas-launch-checklist

### Enhanced
- api-patterns: plan-based authorization, serverless rate limiting, API key auth, usage metering
- seo-patterns: SaaS landing page anatomy, hero section formulas, pricing page SEO, SoftwareApplication schema

## [1.2.0] - 2026-03-24

### Added
- 2 new skills: external-skills-catalog (60+ community skill directory), pyxel-patterns (retro game engine)
- Invisible routing pattern in workflow-router (silent orchestration, decision flowchart)
- Fallback strategy in workflow-router (workaround, combo, create, external)
- One-question rule in collaborative-decisions (max 1 clarifying question)

### Fixed
- a11y-expert.md: added missing YAML frontmatter (CI fix)
- start-observer.sh: converted CRLF to LF line endings (CI fix)

### Credits
- Skill Gateway (buraksu42): Invisible routing, external catalog, one-question rule
- Pyxel (kitao): Retro game engine patterns, pixel art constraints, MML audio

## [1.1.0] - 2026-03-22

### Added
- 6 new skills: ui-ux-patterns, brand-identity, reverse-document, gate-check, design-system-generator, pentest-methodology
- 3 new rules: pre-compact-state, incremental-writing, collaborative-decisions

### Enhanced
- 5 agents enhanced: designer, frontend-dev, accessibility-auditor, technical-writer, security-analyst
- 4 skills updated: coding-standards, design-to-code, frontend-patterns, security

### Credits
- Shannon (KeygraphHQ): Result<T,E> pattern, pentest pipeline, comment philosophy
- UI UX Pro Max (nextlevelbuilder): Named UX rules, UI style catalog, design token architecture
- Game Studios (Donchitos): Context resilience, incremental writing, gate-check system

## [1.0.0] - 2026-03-22

### Added
- 119 specialized agents covering full software development lifecycle
- 202 skills with domain-specific patterns and best practices
- 48 TypeScript hooks for automated context injection and quality gates
- Self-learning pipeline: passive-learner, instinct consolidation, cross-project learning
- Agent swarm mode: multi-agent parallel coordination across 5 phases
- Dev-QA loop: implement, review, retry (max 3), escalate
- Canavar cross-training: one agent's mistake trains the whole team
- Adaptive hooks: intent-based hook activation
- One-line installer (`install.sh`) with zero npm/node dependency
- Pre-built hook distributions (no build step required)
- Comprehensive documentation (README, CONTRIBUTING, SECURITY)

### Agent Categories
- **Core Development:** frontend-dev, backend-dev, devops, ai-engineer
- **Quality:** code-reviewer, security-reviewer, tdd-guide, verifier
- **Architecture:** architect, planner, ddd-expert, clean-arch-expert
- **Infrastructure:** kubernetes-expert, terraform-expert, aws-expert, gcp-expert
- **Database:** database-reviewer, mongodb-expert, redis-expert, elasticsearch-expert
- **Operations:** sentinel, shipper, migrator, canary-deploy-expert

### Skill Categories
- **Tier 1 (Core):** tdd-workflow, frontend-patterns, backend-patterns, coding-standards, security
- **Tier 2 (Stack):** django-patterns, postgres-patterns, redis-patterns, kafka-patterns, kubernetes-patterns
- **Tier 3 (Advanced):** observability, chaos-engineering, event-driven-patterns, rag-patterns, prompt-engineering
