# Verification record for 3.5.0

This document distinguishes reproducible checks from product promises. Version 3.5.0 is a source release candidate; it has not been published by this work.

## Reproduce the checks

Run from the repository root unless a command changes directory:

```bash
cd hooks
npm ci
npm run check
npm run build
npm test
cd ..
npm test
tests/validate-claude-installer.sh
tests/validate-codex-installer.sh
npm ci --ignore-scripts --prefix tools/dashboard
npm test --prefix tools/dashboard
```

Additional installer, dashboard, emitted-bundle and benchmark commands are recorded with their test sources. Use isolated temporary home directories and synthetic events. Do not run memory, learning or swarm automation against a personal installation to obtain a benchmark.

## What the measurements mean

- Catalog counts measure source files or top-level directories. They are not the number of components loaded into every prompt.
- Installed files and bytes measure installation footprint. Fewer bytes on disk do not by themselves establish fewer billed tokens.
- Hook registrations measure configured command invocations. Actual process count depends on lifecycle events and matcher rules.
- Injected characters measure hook-produced context for a stated fixture. Token estimates based on characters are not provider tokenization or billing.
- Microbenchmarks describe a synthetic workload on one environment. They do not prove whole-task speed, quality, reliability or savings for every user.

## Acceptance criteria

Installer checks should verify failure preservation, full-to-core reconciliation, unrelated settings, modified/unmanaged files, backup behavior and generated JSON/TOML. Hook checks should exercise canonical stdin envelopes, session isolation, bounded context, concurrent accounting and emitted ESM execution. Dashboard checks should verify local bindings and reject unexpected HTTP/WebSocket origins. Credential checks use synthetic paths and document parsing limits.

## Context fixture result

Reproduce from the repository root after installing the hook development dependencies:

```bash
node tests/benchmark-context-budget.mjs 3b763b1fb288f57bfa3cce76ef18184b96461a78
```

The checked-in [JSON report](../tests/context-budget-benchmark.json) uses Node 22.23.2 on macOS arm64. It repeats one unchanged 114-character Grep advisory over 20 events in isolated state directories.

| Measured field | Baseline | Updated |
| --- | ---: | ---: |
| Advisory emissions | 20 | 1 |
| Emitted UTF-16 code units | 2,280 | 114 |
| Emitted UTF-8 bytes | 2,280 | 114 |
| Fresh-session context after another session fills its budget | 0 characters | 21 characters |

This is a **95% reduction in repeated advisory payload for this fixture**. It does not measure total session tokens, billed tokens, model quality or whole-task performance. Deduplication is explicitly enabled for this reminder; varying content and separate agent invocations are not automatically removed.

The JSON report also records single-sample elapsed times. The updated version includes filesystem coordination; those values are not an end-to-end latency benchmark or a latency improvement claim. Re-running changes timing values.

## Core skill entrypoint payload

Reproduce from the repository root without calling a model or external service:

```bash
node tests/benchmark-core-payload.mjs 3b763b1fb288f57bfa3cce76ef18184b96461a78
```

The [checked-in report](../tests/core-payload-benchmark.json) sums UTF-8 bytes of the `SKILL.md` entrypoints selected by the core manifest at the baseline and updated tree. Twenty entrypoints were rewritten for bounded workflows with available agents; the selection still contains 32 skills.

| Measured field | Baseline | Updated |
| --- | ---: | ---: |
| Selected core skill entrypoints | 32 | 32 |
| Entrypoint UTF-8 bytes | 197,345 | 58,056 |

This is a **70.58% reduction in available entrypoint instruction bytes**. Skills load on demand: this does not mean every session loads these files, and the result excludes nested references, agents, rules, tool output and model responses. It is not tokenizer output, billed-token savings, a quality score or a latency measurement. Re-run the command after any skill edit so the report and values remain aligned.

## Executed checks

Completed locally on macOS arm64 with Node.js 22.23.2 and npm 10.9.8:

| Check | Result |
| --- | --- |
| Clean hook dependency install | `npm ci --ignore-scripts` passed with the repaired lockfile |
| Hook TypeScript check and build | Passed; all 74 emitted ESM entrypoints rebuilt |
| Hook suite | 296 tests in 17 files passed |
| Installer and packed-runtime suite | 14 tests passed, including a real npm tarball extracted without source dependencies and executable helper modes |
| Claude installer shell validation | Passed using temporary HOME |
| Codex installer shell validation | Passed, including generated JSON/TOML and macOS Bash 3.2 cases |
| Dashboard suite | 8 tests passed: real loopback HTTP/WebSocket, distributed emitter and safe UI fixtures |
| Revised skill metadata | 20 entrypoints parse; all 138 agent metadata records are readable, including CRLF files |
| Independent review | Two fresh exact-commit reviews found and verified repairs for executable permissions and memory symlink escapes; see [review record](independent-review.md) |
| ShellCheck | All repository shell scripts passed at warning severity |
| Media | New GIF decoded and inspected at 1, 3 and 7 seconds; HyperFrames check reported no errors/warnings |

The skill-creator Python validator was unavailable because this environment lacks PyYAML. The repository's frontmatter parser, metadata checks and independent workflow simulations were used instead. This does not establish model-level quality or complete YAML-schema validation.

Live Claude/Codex sessions, real provider billing, PostgreSQL, working native SQLite and real TLDR services were not exercised. Protocol fixtures and optional-dependency absence were tested in isolated state; they do not prove those external integrations work in every environment. The dashboard intentionally trusts other local processes, and regex credential filtering is not a sandbox. Session budget counters persist in a small hashed cache. An abandoned agent-memory write lock skips optional learning with an explicit diagnostic until reviewed after writers stop.

GitHub Actions, release publication and repository social-preview settings are separate from these local checks. No npm version or release tag was published by this work.
