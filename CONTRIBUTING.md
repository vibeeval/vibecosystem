# Contributing to vibecosystem

The optional Claude review workflow runs only on same-repository PRs labelled `claude-review` and requires a configured Anthropic API key. New commits cancel stale review runs. The issue-fix workflow requires the `claude-fix` label and serializes runs per issue. Ordinary validation and tests do not call an LLM.

Prefer changes that make existing workflows reliable, focused and verifiable. New catalog entries should solve a distinct need; the size of the catalog is not a measure of quality or token efficiency.

## Set up a checkout

```bash
git clone https://github.com/vibeeval/vibecosystem.git
cd vibecosystem
cd hooks
npm ci
npm run check
npm run build
npm test
```

Development checks use Node.js 22. The installed runtime uses prebuilt `.mjs` bundles; external tools and optional native dependencies are separate. Do not install the project into your personal home directory just to test a change.

Read [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [SECURITY.md](SECURITY.md) before editing runtime code.

## Agents and skills

An agent is a Markdown file under `agents/` with YAML frontmatter:

```yaml
---
name: my-agent
description: "One clear sentence describing the bounded role"
model: sonnet
tools: [Read, Edit, Bash, Grep, Glob]
---
```

Document the inputs, scope, output and verification required. Claude model metadata stays in the Claude adapter. Do not add project-wide model overrides or use it to route the Codex worker.

A skill lives in `skills/my-skill/SKILL.md`:

```yaml
---
name: my-skill
description: "When the skill applies and what it produces"
user-invocable: false
---
```

Keep the default path short. Move specialist detail into references loaded when needed. Use the exact `SKILL.md` case for Linux compatibility. Check agent and skill references against every profile that installs the skill; a core workflow must have a usable fallback when a specialist is absent.

## Hooks

Hook entry points are under `hooks/src/`. esbuild emits `hooks/dist/*.mjs`. Include committed bundles with source changes and verify they run under Node ESM; an import that works in the test runner can still fail after bundling.

Use JSON from stdin. Canonical tool events use `tool_name`, `tool_input`, `tool_response`, `session_id` and the event's supported metadata. Use shared readers rather than inventing argument-based protocols. Emit only host-supported hook output.

Route optional context through the shared budget at the final output boundary. Budget exhaustion must not remove a permission denial or corrupt a tool input. Limit repeated context and large output, and keep provider token usage separate from character-based estimates.

Register the hook in `hooks/hooks.json`, then select it deliberately in `profiles/runtime-manifest.json`. Source entry-point count, unique registered hook names and command registration count are separate values. Adding a file does not mean it runs in core.

## Verification

For hook changes:

```bash
cd hooks
npm run check
npm run build
npm test
```

For installer or config changes, run the focused installer tests and inspect a temporary-home dry run. Parse generated JSON and TOML. Fixtures must use temporary directories and synthetic credentials, never personal state. Test full-to-core transitions, local edits, unrelated settings and failure recovery when they are affected.

For runtime changes, execute the affected emitted `.mjs` bundle with representative stdin. Optional dependencies should be clearly reported or degrade without claiming the feature succeeded. Dashboard checks belong in its local integration tests.

Use [docs/verification.md](docs/verification.md) for the current command list. Record what was actually run and what remains untested. A test fixture measuring characters or installed bytes does not establish production token savings, model quality or task completion rates.

## Documentation, metadata and visuals

Update the README, architecture guide and upgrade notes when behavior changes. Package/plugin/CLI versions must agree. Keep descriptions explicit about catalog size versus active components. Localized introductions should link to the canonical English technical instructions.

Static diagram sources live in `assets/`. Do not present a scripted animation as a recording of a feature executing. New GIFs need reproducible sources and a truthful caption. Historical media are not current validation evidence.

## Pull requests

Create a focused branch, describe the concrete before/after behavior and include relevant checks and limits. Keep user data and unrelated changes intact. Do not auto-enable memory, swarm, routing or external integrations as part of an ordinary development task.

CI checks frontmatter, counts, shell syntax, TypeScript, bundles and tests. See `.github/workflows/validate.yml` for the workflow. By contributing, you agree that your contributions are licensed under MIT.
