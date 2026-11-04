---
name: test
description: Run relevant repository tests and validate changed behavior through its public entry point.
---

# Test

Use `/test [scope]`. Inspect package scripts, CI, nearby tests and selected runtime. Honor an explicit full-suite request; otherwise begin with checks covering the change.

Run focused regressions and repository-required static checks. Exercise affected API, filesystem, installation, built CLI or browser boundaries. A source import passing does not establish that the distributed artifact works.

Run broader suites when requested or justified by shared contracts and unresolved risk. Parallelize independent checks only when they do not share mutable fixtures, ports or databases. Investigate failures before retrying; distinguish a product defect from unavailable dependencies.

Use temporary state, synthetic credentials and local fixtures. External writes, production data and paid services need authorization; do not silently install global tools or regenerate user environments.

Run directly unless a separate worker helps. An installed Claude `verifier` is optional; Codex retains parent worker settings. No other agent, MCP or indexer is required.

Report commands, pass/fail counts, skipped coverage and limitations. Keep targeted failure diagnostics without exposing secrets. Do not mark unrun checks as passed.
