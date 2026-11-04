---
name: review
description: Review a diff or specified code for concrete correctness, security, compatibility, and regression risks.
---

# Review

Use `/review <paths|diff|PR>`; `--quick` narrows to main risks and `--security` focuses on trust boundaries. Inspect repository guidance, working-tree changes, the diff, affected callers and tests. Resolve the exact PR base and head.

Prioritize actionable defects: concrete trigger, incorrect result, impact and file/line. Check error paths, state, concurrency, input validation, packaging and runtime integration as relevant. Distinguish reproduced failures from source-based risks.

Start with one focused pass. Broad or sensitive changes can benefit from an independent installed `code-reviewer` or `verifier` with a specific scope. The parent synthesizes; avoid redundant reviewers or a mandatory synthesis chain. Codex retains parent worker settings.

Do not edit unless fixes were requested. Run checks that materially resolve a finding. Return prioritized evidence and verification status; if none were found say so and identify untested boundaries. A checklist alone proves neither correctness nor exploitability.
