---
name: debug
description: Investigate a reported failure through relevant logs, code, state, and history without editing the implementation.
---

# Debug

Use supplied issue details, plans and error output. Ask only for critical missing symptoms.

Trace expected versus actual behavior through the smallest relevant path. Inspect entry point, callers and configuration; compare recent changes when available. Form a falsifiable hypothesis and run a focused reversible reproducer. Read relevant log excerpts and redact sensitive values.

Check selected runtime and actual dependency availability before treating environment failures as code bugs. Inspect databases and remote logs only within authorized scope; avoid mutations and expensive queries.

Use one context unless an independent question benefits from an installed Claude `sleuth`. Codex keeps parent settings. Do not require full-file reads, fixed agent chains, global searches or optional tools.

Return root cause or ranked hypotheses, evidence, reproduction steps, smallest proposed repair and verification. State what remains unverified. Keep diagnosis read-only unless a fix is also authorized.
