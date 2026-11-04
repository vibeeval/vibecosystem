---
name: build
description: Implement a feature with a bounded plan, targeted changes, and verification through the real execution path.
user_invocable: true
keywords: [build, greenfield, brownfield, tdd, refactor]
---

# Build

Use `/build [greenfield|brownfield|tdd|refactor] <goal>`. Infer the mode from the request and repository; ask only for missing information that changes the implementation. Honor supplied options, including diagnosis-only or no-commit requests.

Inspect repository instructions, working-tree changes, entry points and affected tests. Search filenames and symbols first, then read the implementation and relevant callers. Reuse a current plan or handoff after checking it against the code.

For a bounded task, state the intended change and implement it directly. For work spanning components, make a short plan with acceptance criteria, dependencies and verification. Preserve user changes, compatibility, state formats and error paths. In TDD mode establish a meaningful failing test before the fix; in refactor mode preserve observable behavior.

Run focused checks and exercise the public entry point, including built or installed artifacts when relevant. Broaden verification for affected boundaries or unresolved risk. Investigate demonstrated failures; report environment blockers rather than retrying indefinitely.

Review the diff and report behavior, checks and limitations. Commit or prepare a PR only within the requested workflow; publishing and destructive migrations require authorization.

Work in the parent context by default. For a concrete independent question Claude can use installed `scout`, `planner`, `spark`, `code-reviewer` or `verifier`. Give relevant paths and a short evidence-based output contract; reuse workers and avoid overlapping edits. Codex retains its parent `luna_worker` model and reasoning; Claude model metadata does not select a Codex model.

No additional skill, MCP, indexer, memory service or swarm is required. Use optional tools only when installed and useful.
