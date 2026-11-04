# Runtime reconstruction

This map was derived from the source at baseline `3b763b1fb288f57bfa3cce76ef18184b96461a78` and updated with the 3.5.0 candidate. It describes executable paths and their limits, rather than treating catalog descriptions as implemented services.

## Installation and selection

`install.sh` and `bin/cli.mjs init` call `tools/install-runtime.mjs`. The installer resolves inheritance and aliases through `tools/profile-runtime.mjs` and `profiles/runtime-manifest.json`, copies selected files, and merges registrations from `hooks/hooks.json` into the user's Claude settings. It records file hashes and owned hook identities in `vibecosystem-runtime.json`.

The ownership record is essential: profile changes can replace or prune only known, unchanged managed files. Modified files remain conflicts; backups hold replaced content. Unknown legacy hashes must remain unknown across repeated installations. Other tools' files and hook commands are not adopted merely because their contents match.

The remote installer manages a source checkout separately from the installed runtime. A failed update stops with the checkout preserved. A dry-run must not clone, pull, or install. The installed `vibeco` launcher uses the recorded source checkout for future profile changes; it must fail if that source no longer exists rather than changing only a profile label.

The Codex adapter installs skills and optionally a model-pinned `luna_worker`. It does not execute Claude hooks or reinterpret Claude's model metadata.

## Host events and output

Claude starts a registered hook process and provides JSON on stdin. Relevant fields include `session_id`, `cwd`, `tool_use_id`, `tool_name`, `tool_input` and, after a tool completes, `tool_response`. Responses may be strings, Bash stdout/stderr, Read file content or Agent text blocks. The shared reader configures context scope; the response helper normalizes text and retains compatibility with older adapters' `tool_output`.

Permission decisions and rewritten tool inputs are executable semantics. They must survive advisory-budget exhaustion unchanged. Retrieved code and suggestions belong in bounded `additionalContext`; shortening an arbitrary permission reason or prompt can corrupt the operation.

`hooks/dist/*.mjs` are the actual shipped artifacts. Source unit tests alone cannot catch stale bundles, missing event registration or native modules resolved from the wrong directory. The packed-runtime regression extracts a real npm tarball into an isolated fixture, installs it, invokes registered core bundles, switches opt-in profiles, and checks optional-dependency absence.

## State and repeated context

Context accounting is scoped by project and session. Tool invocations share an event cap using `tool_use_id`; other events use a payload fingerprint. Reservations are serialized and atomically persisted. Missing session IDs get process-local accounting. Exact repeated reminders can opt into session deduplication; per-invocation data remains distinct. Small hashed counters remain on disk after sessions.

Agent memory respects user, project and local storage scopes. Smart recall filters the active project and lexical relevance before selecting excerpts. This is heuristic retrieval, not a guarantee of truth. SQLite, Python/UV, TLDR and external providers are optional dependencies and need separate validation when enabled. Missing optional SQLite now produces a diagnostic instead of failing during module import.

## Dashboard and external effects

The `dashboard` profile adds local structural telemetry to core. Its emitter is registered both before Agent/Task calls and after completed tools; `full` includes those registrations too. The local HTTP receiver validates events and broadcasts them over WebSocket. The UI/API and receiver bind to loopback, check browser Host/Origin, and use local CSS. Other local processes remain in the same trust boundary.

Braintrust extraction and GitHub issue/comment creation require explicit environment opt-ins in addition to available credentials. Installing or running core does not authorize background publication. Optional integrations can still send data to their configured services when explicitly enabled.

## What this does not establish

Agent definitions and skill instructions are capabilities exposed to a host model, not a scheduler that guarantees each agent runs. Regex credential checks are a best-effort guard. Character caps are not token billing limits. The benchmark fixtures measure instruction bytes and emitted advisory characters; they do not prove task quality, model cost or end-to-end speed. See [verification.md](verification.md) for executed checks and remaining boundaries.
