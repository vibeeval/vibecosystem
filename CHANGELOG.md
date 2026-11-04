# Changelog

All notable changes to vibecosystem will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.5.0] - Unreleased

This version is being prepared in source. No npm publication, release tag or deployment is implied.

### Changed

- Claude CI review is opt-in through the `claude-review` label and cancels stale runs. Ordinary validation does not call an LLM.
- Added an explicit `dashboard` profile for local agent/tool activity monitoring; it is also included in `full`.
- Twenty core skill entrypoints now use bounded workflows with available agents. Entrypoint-byte comparisons and their limits are recorded in the verification guide.
- Default-profile documentation now distinguishes catalog contents, installed components and hook registrations. Removed unsupported token-saving multipliers, completion rates and automatic swarm guarantees from current product copy.
- Refreshed localized introductions and replaced legacy workflow GIF embeds with a locally rendered, editable HyperFrames product GIF and source-controlled runtime diagrams. Historical media are explicitly labeled.
- Synchronized package and plugin metadata at 3.5.0. Optional dependencies, data destinations and security boundaries are documented.

### Fixed

- Linux CI exposed a bundled transcript-parser CLI side effect in the PreCompact hook. Parsing is now a pure shared module with a separate CLI wrapper; canonical-path package tests reproduce the previous failure on macOS too. Continuity ledger/handoff paths reject symlink escapes and save messages reflect actual writes.

- Independent follow-up review found two additional regressions before publication: executable skill permissions are preserved (including legacy repair and user-mode conflicts), and agent-memory paths reject symlink escapes before reads/writes. A bounded cooperative lock protects append/retention from lost parallel updates.

- Remote installer update failures stop without removing the checkout. Normal Claude and Codex installs reconcile unchanged owned files, preserve modified/unmanaged files and back up replacements.
- The installed CLI and npm `vibeco` alias are available through explicit launchers; profile changes use the recorded source repository.
- Hook input readers accept canonical stdin events and `tool_response`. Agent memory honors user/project/local scopes, and recall requires relevant content.
- Hook context accounting separates sessions and coordinates writes. Explicit deduplication avoids repeating unchanged optional reminders; truncation preserves valid text.
- Optional native SQLite loading works from emitted ESM bundles and reports missing/incompatible dependencies. Braintrust extraction and GitHub-mutating hooks require explicit opt-in flags.
- The optional dashboard binds to loopback and validates browser origins for HTTP and WebSocket requests. Credential-path matching covers additional supported shell forms while remaining a best-effort guard.

### Verification

- See [the verification record](docs/verification.md) for reproducible checks, measurements and their limitations. Historical changelog claims below describe their original releases and are not current benchmark evidence.

## Earlier unreleased changes

### Changed
- **Single Codex model authority**: Added the canonical bounded `.codex/agents/luna-worker.toml` using `gpt-5.6-luna` with `max` reasoning. Removed the project-level `o4-mini` pin, invalid local history persistence, and stale skill path override.
- **Lean runtime profiles**: `core` is now the default; `minimal`/`smart` alias to `core`, and `all` aliases to `full`. Claude-only Opus/Sonnet frontmatter remains available without entering the Codex worker path. Core relies on bounded project instructions and selected safety hooks; full keeps the original 20 rules.
- **Bounded context and ownership**: Core injectors enforce 4k/event and 12k/session budgets, full retains 8k/50k, token telemetry uses explicit estimated/provider fields, and installers back up before overwrite or prune only owned files.

### Added
- **Codex luna worker installer**: `install-codex.sh` now supports `--install-luna-worker`, `--validate-luna-worker`, `--dry-run`, and `--prune` without copying global `AGENTS.md` or the full skill tree by default.
- **`vibeco effective-config`**: Reports the worker model, project model neutrality, active runtime profile, registered hooks, and context budgets.
- **vibeco audit**: security + quality scanner for the local installation (SAST-style checks)
- **vibeco secrets**: API key and credential scanner
- **legacy profile aliases**: `smart` now aliases the lean `core` runtime and `all` aliases `full`; use `full` explicitly for every capability.
- **Hook registration on install**: `hooks/hooks.json` manifest (53 hook commands across 7 events) + `tools/register-hooks.mjs`; `install.sh` and `npx vibecosystem init` now merge only the selected profile's registrations into `~/.claude/settings.json`.
- **session-banner hook source**: ported orphan `dist/session-banner.mjs` to `hooks/src/session-banner.ts` so it rebuilds from source (hook count 73 -> 74)

### Fixed - Security
- **typescript-preflight shell injection**: tool-controlled `filePath` was interpolated into an `execSync` shell string; now uses `execFileSync` with array args
- **vibeco update path interpolation**: repo path no longer interpolated into a `cd` shell string (uses `cwd` option)

### Fixed
- **27 skills unreadable on Linux**: lowercase `skill.md` renamed to `SKILL.md` (case-sensitive filesystems never loaded them)
- **bin/cli.mjs profile schema**: `npx vibecosystem init --profile X` now writes the same `plugin-config.json` schema as `vibeco profile X` (previously the two CLIs wrote incompatible formats and `smart` was rejected)
- **Count drift across docs**: canonical counts synced to 138 agents / 296 skills / 74 hooks / 20 rules in README, 13 translated READMEs, ARCHITECTURE.md, AGENTS.md, plugin.json, marketplace.json, install scripts, profiles and rules
- **Stale docs**: ARCHITECTURE.md numbers, SECURITY.md supported versions (1.x -> 3.x), dead `prompt.md` references in UPGRADING/CONTRIBUTING/PR template, fabricated codebase-memory MCP tool names in docs/mcp-integrations.md, ghost agent references in rules

### Planned
- Community contribution workflow
- agentskills.io format migration (v4.0)

## [3.3.0] - 2026-04-13

### Fixed - Security
- **Credential-deny symlink bypass** (CRITICAL): Added `readlinkSync` + `realpathSync` to resolve symlinks before path matching. Previously a symlink like `/tmp/x -> ~/.ssh/id_rsa` would bypass the deny hook. Now both the original path and the resolved target are checked.

### Added - CI Quality Gates
- **TypeScript type check in CI**: Added `npx tsc --noEmit` step to catch type errors before merge
- **Dist parity check in CI**: Verifies `hooks/dist/` matches source. Fails if stale build artifacts are committed

### Added - Hook Health Ledger
- **hook-health.ts shared module** (`hooks/src/shared/hook-health.ts`): `reportHealth()` and `wrapWithHealth()` functions that log hook success/failure/duration to `~/.claude/hook-health.jsonl`
- **5 critical hooks instrumented**: credential-deny, intent-classifier, model-router, skill-compounder, skill-curator now report health metrics
- **vibeco doctor --runtime**: Shows hook execution stats from last 24h (runs, success rate, avg duration). Highlights broken hooks

### Added - Marketplace
- **marketplace.json**: Plugin marketplace manifest with categories, features, compatibility, and install instructions
- **npm + marketplace badges** in README

### Changed - Naming Cleanup
- **50 prompt.md -> SKILL.md**: All remaining `prompt.md` files renamed to `SKILL.md` for consistency
- **8 snake_case -> kebab-case**: Renamed skill directories (continuity_ledger, create_handoff, etc.) to kebab-case
- **accessibility-auditor merged into a11y-expert**: Removed duplicate agent

### Changed
- vibeco CLI version bumped to 3.3.0
- All version references updated across package.json, plugin.json, bin/cli.mjs, marketplace.json

## [3.2.0] - 2026-04-12

### Added - Autonomous Skill Evolution Loop
- **skill-compounder hook** (`hooks/src/skill-compounder.ts`): Stop hook that analyzes completed sessions for repeated successful patterns and error-recovery sequences. Auto-generates SKILL.md drafts in `~/.claude/skills-drafts/` with confidence scores. Zero manual review needed.
- **skill-curator hook** (`hooks/src/skill-curator.ts`): SessionStart hook that reviews drafts, promotes high-confidence ones (>= 80) to active skills, archives low-quality (< 50), and detects duplicates. Completes the autonomous observe -> draft -> review -> promote loop.
- **skill-curator skill** (`skills/skill-curator/SKILL.md`): Documents the lifecycle and criteria.

### Added - 3-Depth Progressive Recall
- **recall-layers shared module** (`hooks/src/shared/recall-layers.ts`): Three-depth fetch pattern for memory queries:
  - Depth 1: IDs only (~10 tokens per match) - cheapest, for filtering
  - Depth 2: Summary (room, type, preview) - middle layer
  - Depth 3: Full content (~500+ tokens) - only for confirmed matches
- **layered-recall skill updated**: Now documents both 4 scope layers AND 3 depth layers for 10-50x token savings via fetch-on-confirmation pattern.

### Added - Pre-Research Topic Resolution
- **topic-resolver skill** (`skills/topic-resolver/SKILL.md`): Maps vague queries to concrete entities (GitHub orgs, X handles, subreddits, docs URLs) BEFORE searching. Caps at 8 entities.
- **oracle agent updated**: Now runs topic-resolver as Step 0 before any search. Adds Recommended Skills section referencing topic-resolver and knowledge-graph.

### Changed
- Updated counts: 138 agents, 295 skills, 73 hooks, 20 rules
- Version bumped: 3.1.1 -> 3.2.0

### Context
This release closes the **autonomous self-improvement loop**: vibecosystem now observes your sessions, detects procedural patterns, generates skill drafts automatically, reviews them on next session start, and promotes the best ones without any manual review. Combined with 3-depth progressive recall, this creates a system where skills compound in quality over time with zero user intervention.

## [3.1.1] - 2026-04-12

### Fixed - Security (HIGH)
- **Path traversal in palace hooks** (H1): Added `sanitizeProjectName()` and `getSafeProjectName()` to `hooks/src/shared/project-identity.ts`. Now all palace hooks (palace-auto-save, palace-recall, session-compressor, graph-indexer) sanitize project names and verify resolved paths stay within PALACE_DIR
- **Path traversal in model-router** (H2): Added whitelist regex `^[a-zA-Z0-9_-]+$` for agent names to prevent arbitrary `.md` file reads

### Fixed - Bugs
- **Wrong hook output format**: 4 hooks used `result: 'approve'` (not a valid output). Fixed to use `hookSpecificOutput` or silent exit: tamagotchi-engine, palace-auto-save, model-router, token-tracker
- **Silent SessionStart failure**: palace-recall and graph-indexer read only legacy `event.type` field, not canonical `event.source`. Fixed to support both
- **Non-portable stdin**: 7 hooks used `/dev/stdin` (breaks on Windows). Fixed to use FD 0: `readFileSync(0, 'utf-8')`
- **Duplicate project detection**: 4 hooks reimplemented `getProjectName()`. Now all use shared `getSafeProjectName()` from `shared/project-identity.ts`
- **bin/cli.mjs --profile flag was cosmetic**: Now actually reads profile JSON, computes disabled agent/skill sets, writes to `plugin-config.json`
- **bin/cli.mjs --profile bounds check**: Added validation for missing/invalid profile values
- **Tamagotchi switch case `const` leak**: Wrapped `case 'Agent'` in braces
- **Tamagotchi float drift**: Integer-based stat decay instead of 0.1 increments
- **Palace room detection false positives**: Requires 2+ keyword matches instead of 1

### Fixed - Version/Count Consistency
- `plugin.json`: version 3.0.0 -> 3.1.1, description updated to "293 skills, 71 hooks"
- `package.json`: version 3.1.0 -> 3.1.1, description updated, removed references to missing `CLAUDE.md` and `hooks/hooks.json` from `files[]`
- `README.md`: badges updated (skills 285 -> 293, hooks 66 -> 71), ASCII diagram, profile table, directory table all corrected
- `rules/vibecosystem-welcome.md`: banner v2.3 -> v3.1
- `tools/vibeco/vibeco.mjs`, `bin/cli.mjs`: VERSION constants aligned to 3.1.1

### Fixed - Stub Skills
- `skills/phase-gated-commits/SKILL.md`: Filled in with pattern, rules, template, integration
- `skills/plan-documentation/SKILL.md`: Filled in with structure, completion docs, lifecycle

### Fixed - CI Hardening
- `.github/workflows/claude-fix.yml`: `contains(label.name, 'claude-fix')` -> `label.name == 'claude-fix'` (exact match, prevents substring bypass)
- `.github/workflows/validate.yml`: `ludeeus/action-shellcheck@master` pinned to `@2.0.0` (no floating refs)

### Context
Comprehensive review by 4 parallel agents (Explore, security-reviewer, code-reviewer, janitor) found ~90 issues. This release addresses all P0 (release blockers) and P1 (correctness) findings. P2/P3 cleanup (dead code in hooks/src/shared/, stale agent matrix, 45 skills using `prompt.md` instead of `SKILL.md`) scheduled for v3.2.0.

## [3.1.0] - 2026-04-08

### Added
- **Achievement System** (`skills/achievements/` + `hooks/src/achievement-tracker.ts`): Steam-style gamification
  - 25 achievements across 5 skill trees (Code Warrior, Bug Slayer, Architecture Master, Security Guardian, Team Player)
  - XP, levels (1-50), daily streaks with multipliers
  - State in `~/.claude/achievements.json`
- **Experiment Loop** (`skills/experiment-loop/`): Autonomous optimize-test-keep/discard loop
  - Hypothesize > Modify > Test > Evaluate > Decide, max 10 per run
  - Git stash safety, results in `thoughts/EXPERIMENTS.md`
- **Darwinian Skill Evolution** (`skills/skill-evolution/`): Self-improving skills
  - 5-dimension scoring (accuracy, relevance, token efficiency, satisfaction, reusability)
  - Crystallization at 90+ score, auto-repair below 30
- **Self-Healing Codebase** (`skills/self-healing/`): Auto-repair pipeline
  - 4-phase: Detect > Diagnose > Fix > Validate, confidence gate at 80%
  - Git stash safety, scope limits (never auto-fix security/DB/auth)
- **Agent Tamagotchi** (`skills/agent-tamagotchi/` + `hooks/src/tamagotchi-engine.ts`): Terminal pet
  - 12 species deterministic from username, 5 stats, 7 moods
  - Reacts to workflow: happy on test pass, sad on build fail
- **Auto Art Director** (`skills/art-director/`): AI image generation direction
  - 5-component prompt formula (Subject, Style, Composition, Lighting, Technical)
  - Templates for banners, diagrams, social media, presentations

### Changed
- Updated counts: 138 agents, 293 skills, 71 hooks, 20 rules

## [3.0.1] - 2026-04-08

### Added
- **Memory Palace system** (`skills/memory-palace/SKILL.md`): Hierarchical memory organization
  - Wings (projects) > Rooms (domains) > Drawers (decisions)
  - Flat JSONL storage in `~/.claude/palace/`
  - Auto room detection from 10 domain categories
- **Session Compression** (`skills/session-compression/SKILL.md`): ACDE format for context compression
  - Actions, Context, Decisions, Entities extraction
  - 10-30x token reduction while preserving all actionable info
- **Layered Recall** (`skills/layered-recall/SKILL.md`): 4-layer progressive memory loading
  - L1: Identity (always, ~200 tokens), L2: Facts (per-project, ~500 tokens)
  - L3: Room recall (on-demand), L4: Deep search (explicit)
  - 4-6x token savings vs loading everything
- **Palace auto-save hook** (`hooks/src/palace-auto-save.ts`): Auto-detects decisions/discoveries from agent outputs
- **Session compressor hook** (`hooks/src/session-compressor.ts`): ACDE compression before context window fills
- **Palace recall hook** (`hooks/src/palace-recall.ts`): Loads Layer 1-2 memories at session start

### Changed
- Updated counts: 138 agents, 288 skills, 69 hooks, 20 rules
- Anthropic marketplace submission

## [3.0.0] - 2026-04-07

### Added
- **npm package**: `npx vibecosystem init` one-command install (`bin/cli.mjs`)
  - Profile selection: `npx vibecosystem init --profile frontend`
  - Health check: `npx vibecosystem doctor`
  - Force mode: `npx vibecosystem init --force`
- **plugin.json**: Official Claude Code plugin manifest for ecosystem compatibility
- **Worktree isolation**: `isolation: worktree` added to 60 producer agents for true parallel execution
  - Producer agents (code writers) get worktree isolation
  - Consumer agents (readers, orchestrators) remain shared
- **Model routing hook** (`hooks/src/model-router.ts`): Multi-LLM tier routing
  - Tier 1 (Haiku): doc-updater, technical-writer, babel, i18n-expert, etc.
  - Tier 2 (Sonnet): code-reviewer, frontend-dev, backend-dev, etc. (default)
  - Tier 3 (Opus): architect, planner, kraken, sleuth, etc.
  - Recommends via additionalContext, never forces
- **Knowledge graph skill** (`skills/knowledge-graph/SKILL.md`): codebase-memory MCP integration
  - 6-71x token savings vs raw file reading
  - Auto-index on session start via graph-indexer hook
  - Search, architecture, call-path tracing
- **Graph indexer hook** (`hooks/src/graph-indexer.ts`): Auto-suggests indexing on session start
- **Token tracker hook** (`hooks/src/token-tracker.ts`): Estimates token usage per tool call
  - Writes to `~/.claude/token-usage.jsonl`
  - Broadcasts to dashboard WebSocket
- **Dashboard v2 endpoints**: `/api/tokens`, `/api/costs` for token/cost tracking
  - Per-tool and per-agent token breakdown
  - Cost estimates for Haiku/Sonnet/Opus tiers

### Changed
- Updated counts: 138 agents, 285 skills, 66 hooks, 20 rules
- Root `package.json` added for npm distribution
- `.npmignore` added for clean npm packaging

### Context
Competitive analysis of 20+ Claude Code ecosystem repos identified critical gaps: no npm distribution (every 10K+ star repo has it), no plugin.json (invisible to official ecosystem), no worktree isolation (free parallelism), no model routing (70-85% cost savings possible), no knowledge graph (6-71x token savings). This release closes all gaps.

## [2.4.1] - 2026-04-07

### Fixed
- **CI pipeline**: Added `hooks/package-lock.json` to repo (was in `.gitignore`, causing `npm ci` to fail on every push since v2.3.1)
- **Asset counts**: Updated 283->284 skills, 60->63 hooks across README, 12 translations, install scripts, profiles, AGENTS.md, and Cursor/Codex configs
- **README badge anchors**: Added `<a name>` targets for `#agents`, `#skills`, `#hooks`, `#rules` badge links
- **validate.yml**: Fixed skill counting (was checking `prompt.md`, now checks `SKILL.md`) and added hook count to asset report

## [2.4.0] - 2026-04-07

### Added
- **Terminal HUD / Statusline** (`hooks/src/statusline-writer.ts`): Real-time session state in `~/.claude/statusline.json`
  - Tracks: agent spawns/completions/errors, tool count, session duration, active profile, current intent
  - Compatible with Claude Code's native `statusLine` config for terminal display
  - Shared utilities in `hooks/src/shared/statusline.ts`
- **Prompt Auto-Improver** (`hooks/src/prompt-improver.ts`): Enriches vague prompts with context
  - Triggers on short prompts (< 10 words) with vague verbs ("fix", "do", "make")
  - Injects recently changed files, last error from Canavar, current intent
  - Does NOT modify user prompt - only adds `additionalContext`
- **Persistent Planning System** (`hooks/src/plan-tracker.ts` + `skills/persistent-planning/`):
  - 3-file planning: `thoughts/PLAN.md` (active plan), `thoughts/PROGRESS.md` (auto-tracked commits), `thoughts/CONTEXT.md` (project context)
  - Session start: auto-injects active plan into context
  - After commits: auto-appends to PROGRESS.md with hash, message, timestamp
  - Based on planning-with-files pattern (96.7% task completion rate)

### Context
Features prioritized from competitive analysis of 20+ Claude Code ecosystem repos (143K stars leader). Terminal HUD (17K stars for claude-hud), prompt improvement (1.3K stars), and persistent planning (18K stars) were the highest-ROI gaps identified.

## [2.3.1] - 2026-04-07

### Added
- **54 unit tests** for hook utilities (vitest): plugin-check, session-id, project-identity, frontmatter parsing
  - `cd hooks && npm test` now passes with 54 tests across 4 files
- **`vibeco search`** command: fuzzy search across agents and skills by name/description
- **ARCHITECTURE.md**: Complete system architecture document with Mermaid diagrams, hook lifecycle, agent routing, self-learning pipeline, profile system, and contributor guide
- **CODE_OF_CONDUCT.md**: Contributor Covenant v2.1
- **GitHub issue templates**: Upgraded from .md to YAML forms with dropdowns, component selection, and version fields

### Changed
- **CONTRIBUTING.md**: Expanded from 52 to 120+ lines with hook development guide, skill authoring guide, agent creation guide, testing instructions, and vibeco CLI reference
- **validate.yml**: Added `test-hooks` CI job that runs `npm test` on every push/PR
- **vibeco CLI**: Added `search` command to help text and command router

## [2.3.0] - 2026-04-07

### Added
- **vibeco CLI** (`tools/vibeco/vibeco.mjs`): Zero-dependency Node.js CLI for the ecosystem
  - `vibeco help` - command reference
  - `vibeco stats` - agent/skill/hook/rule counts, error rates, instinct counts
  - `vibeco list <agents|skills|hooks|rules> [--search term]` - browse and search components
  - `vibeco dashboard` - start monitoring UI as background process
  - `vibeco doctor` - 11-point health check (directory, counts, hooks, dashboard, memory, PATH, Node.js)
  - `vibeco profile <name>` - switch between preset profiles
  - `vibeco update` - pull latest and reinstall
- **6 preset profiles** (`profiles/*.json`): Token-saving component selection
  - `minimal` (~15 agents, ~40 skills) - core review/test/verify only
  - `frontend` (~30 agents, ~60 skills) - React/Next.js/CSS/a11y
  - `backend` (~44 agents, ~74 skills) - API/DB/security
  - `fullstack` (~59 agents, ~96 skills) - frontend + backend combined
  - `devops` (~33 agents, ~61 skills) - CI/CD/K8s/cloud
  - `all` (138 agents, 283 skills) - everything (default)
- **One-liner remote install** (`install-remote.sh`): `curl -fsSL https://raw.githubusercontent.com/vibeeval/vibecosystem/main/install-remote.sh | bash`

### Changed
- `install.sh`: Added `--non-interactive` flag, profiles directory installation, vibeco CLI symlink setup
- README: Added one-liner install, vibeco CLI reference, profiles table

## [2.2.4] - 2026-04-06

### Added
- **1 new skill**: content-marketing (AI slop detection with 30+ patterns, 5-dimension content scoring, watermark cleaning, copywriting formulas AIDA/PAS/BAB, programmatic SEO, content cluster strategy)

### Changed
- **Token optimization**: Moved 3 rules to skills (commit-trailers, tldr-cli, handoff-templates) saving ~3,400 tokens/session
- Updated counts: 138 agents, 283 skills, 60 hooks, 20 rules

### Removed
- 3 rules moved to skills (still available as skills, no longer injected every session)

## [2.2.3] - 2026-04-05

### Added
- **5 new skills**: agent-linter (agent/skill file validation with 10+ rule categories), experiment-engine (autonomous modify-verify-keep/discard optimization loop), cognitive-modes (5 thinking modes: analytical/creative/systematic/rapid/debug), autonomous-pr (self-fixing PR lifecycle with CI retry and budget controls), circuit-breaker (agent error tolerance with fallback chains and exponential backoff)

### Changed
- Updated counts: 138 agents, 279 skills

## [2.2.2] - 2026-04-05

### Added
- **1 new agent**: resource-manager (token budget tracking, agent cost analysis, ROI reporting)
- **3 new skills**: knowledge-management (4-layer knowledge organization, progressive summarization, ADR templates), agent-qa-testing (agent protocol compliance testing, role boundary verification, personality drift detection), token-budget (per-agent cost tracking, budget planning, optimization strategies)

### Changed
- Updated counts: 138 agents, 274 skills

## [2.2.1] - 2026-04-04

### Added
- **1 new agent**: monetization-expert (Kerem Bozkurt persona, 7-step paywall pipeline orchestrator)
- **2 new skills**: paywall-optimizer (AI-powered A/B testing, churn prediction, push strategies, "kapali carsi esnafi" sales techniques), codex-orchestration (Codex CLI + Claude Code dual workflow patterns, GitHub Actions examples)
- **3 updated skills**: revenuecat-patterns (expanded SDK patterns for 4 platforms), paywall-strategy (14-category benchmarks, regional pricing for 18 countries), subscription-pricing (3-tier framework, win-back campaigns, A/B methodology)

### Changed
- Updated counts: 138 agents, 271 skills, 60 hooks, 23 rules
- agent-assignment-matrix updated with monetization task routing

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
- Updated counts: 138 agents, 271 skills, 60 hooks, 23 rules (see v2.2.1 for current)

## [2.1.2] - 2026-03-30

### Added
- **1 new agent**: paywall-planner (AI paywall strategy planner with category benchmarks, RevenueCat/Adapty config generation)
- **3 new skills**: paywall-strategy (15 category benchmarks, model selection), revenuecat-patterns (SDK integration for Swift/Kotlin/RN/Flutter), subscription-pricing (tier design, PPP, churn reduction)
- **6 new skills** adapted from Trail of Bits (4.1K stars): differential-review (blast radius, risk-adaptive depth), insecure-defaults (fail-open detection), variant-analysis (bug sibling hunting), sharp-edges (API footgun detection), fp-check (false positive verification), property-based-testing (PBT patterns for fast-check/Hypothesis/gopter)
- Dependency risk scoring merged into existing supply-chain-security skill
- RevenueCat and Trail of Bits added to Inspired By section

### Changed
- Updated counts across all files: 138 agents, 271 skills
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
