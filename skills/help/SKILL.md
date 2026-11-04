---
name: help
description: Explain capabilities actually installed in this workspace and route to an available workflow.
triggers: ["help", "what can you do", "show capabilities", "how do I"]
allowed-tools: [AskUserQuestion, Bash, Read, Glob, Grep]
priority: high
---

# Help

Answer the specific question first. Without a goal, show a few common tasks and invite one; avoid a multi-stage interview.

Inspect `~/.claude/vibecosystem-runtime.json` or the configured Claude directory. Compare selected capabilities with actual agent/skill files and `settings.json` registrations. Repository catalog counts are not an active runtime. Use `vibeco effective-config`, `vibeco profile` or `vibeco doctor` when available, checking output.

Core workflows: `build` implements, `debug` investigates, `fix` repairs, `explore` maps code, `plan-agent` plans, `review` reviews, `refactor` restructures, `tdd` works test-first, `test` verifies.

For a named component inspect only its installed file. For hooks explain relevant events and current profile. Check optional tool availability; ordinary work uses built-in search, read, edit and commands.

Core is bounded. Memory, context retrieval, orchestration and full are opt-in profiles. Do not activate or install them merely to explain them. Codex retains its configured parent worker; Claude model metadata does not alter it. Explain missing capability or access and the smallest available next step.
