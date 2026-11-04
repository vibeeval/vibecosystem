---
name: system-overview
description: Explain actual profile selection, installation, hook execution, and optional integrations.
---

# System Overview

Use `profiles/runtime-manifest.json`, installed `vibecosystem-runtime.json`, `plugin-config.json` and `settings.json` as available. Do not invent learned-fact counts, savings or service availability.

Flow: select profile → install selected files → merge owned registrations → Claude sends stdin event JSON → bundled hook emits supported event output. Repository files form a catalog; only registered hooks run. Agents support scoped delegation and skills load when applicable.

Core supplies bounded implementation and verification. Quality adds checks; context retrieval; memory and orchestration are opt-in; full selects legacy capabilities. Verify optional dependencies before claiming these integrations work.

Context budgets bound advisory text, not model billing or permission semantics. Explain configured limits. Empty output can mean no relevant context, exhausted allowance, unavailable optional dependency or failure; inspect stderr and health checks to distinguish.

Codex has a separate `luna_worker` adapter. Project configuration does not override its model; Claude model fields do not route Codex.

Use available `vibeco effective-config`, `profile` and `doctor` commands. Explain a requested subsystem instead of dumping the full catalog. No database, setup wizard, past memories or external service is assumed.
