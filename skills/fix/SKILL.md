---
name: fix
description: Diagnose and repair a reproducible bug, hook failure, dependency error, or requested PR feedback.
allowed-tools: [Bash, Read, Grep, Write, Edit, Task]
---

# Fix

Use `/fix [bug|hook|deps|pr-comments] <issue>`. Honor `--dry-run` as diagnosis only, `--no-test` as no new test creation, and `--no-commit` as no commit. Existing verification still matters.

Establish expected versus actual behavior from the request, logs or failing test. Inspect the entry point, callers, configuration and current diff. Reproduce with isolated fixtures when practical; identify the cause before changing unrelated code.

- **Bug:** Add a focused regression when it protects meaningful behavior. Apply the smallest complete correction and rerun affected checks.
- **Hook:** Verify event registration, stdin JSON, built bundle, exit status and emitted protocol. Test the installed entry point with temporary HOME/project data.
- **Dependencies:** Check selected runtime, lockfile, declaration and actual import. Use the project's package manager; do not remove user data to hide an install failure.
- **PR feedback:** Fetch the requested comments when available, inspect current code, and resolve supported issues. Report disagreements with evidence. Do not post replies unless asked.

Complex investigation can use an installed Claude `sleuth`; implementation `spark`, verification `verifier`. Delegation is optional; Codex keeps parent worker settings. Do not require an unavailable agent or service.

Report root cause, changed behavior, reproducer or checks, and remaining uncertainty. Avoid auto-commits and repeated interview phases the request does not require.
