---
name: cli-reference
description: Find version-correct Claude Code CLI flags and configure bounded headless or interactive commands.
allowed-tools: [Read, Bash]
---

# CLI Reference

If `claude` is available, check `claude --version` and `claude --help` for exact options. Otherwise use current official documentation and report host validation unavailable; do not install the CLI just to answer. Do not assume a remembered flag exists. Codex is a separate host with its own commands and worker configuration.

Common patterns are interactive `claude`, a supplied initial prompt, and print/headless mode `claude -p <prompt>`. Verify resume, output format, tool permissions and turn limits against the installed version before using them. Capture command arguments as structured data; avoid shell interpolation of prompts or filenames.

For automation, set a task-specific working directory, bounded scope and an appropriate execution limit. Supply only needed context and tools. Preserve normal permission handling; an unattended workflow does not imply permission to bypass it. Do not start recursive agents or external side effects merely to demonstrate flags.

For a local vibecosystem checkout, inspect installation with `node bin/cli.mjs init --profile core --dry-run`. Use `npx vibecosystem init` only when the published package is intended. `vibeco help` describes the installed CLI; `effective-config`, `stats` and `doctor` inspect runtime state. Profile changes need a retained source checkout and preserve conflicting user files.

Explain the selected command, relevant options and observed result without dumping a complete external manual.
