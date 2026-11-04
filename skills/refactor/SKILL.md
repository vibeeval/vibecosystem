---
name: refactor
description: Restructure specified code while preserving observable behavior and verifying affected callers.
---

# Refactor

Inspect the requested area, consumers, public contracts and tests. Identify the maintenance problem and keep unrelated cleanup out of scope.

For a small extraction or rename, check callers and implement directly. For changes across boundaries, state the target structure and staged compatibility plan. Preserve state formats, errors and public interfaces unless the user requested a change.

Establish behavior using existing checks; add characterization coverage for an important untested boundary. Make cohesive edits, update consumers and run focused checks. Broaden verification for shared contracts. Compare the final diff with the goal.

An installed Claude `refactor-cleaner`, `architect` or `code-reviewer` may help with an independent scope. A multi-agent pipeline is optional; Codex keeps parent worker settings.

Report the structural improvement, evidence of preserved behavior, compatibility implications and risks. Do not automatically commit, migrate or publish.
