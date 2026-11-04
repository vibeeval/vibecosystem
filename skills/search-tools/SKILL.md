---
name: search-tools
description: Use available file, text, AST, or semantic search without requiring optional integrations.
user-invocable: false
---

# Search Tools

Prefer filename search for paths, text for names and scoped caller tracing for behavior. Check availability before invoking optional tools.

- `rg --files -g '*router*'`: locate paths.
- `rg -n 'symbolName' src tests`: locate definitions and consumers.
- Installed AST search: syntax-sensitive patterns.
- A current semantic index: conceptual queries exact search cannot resolve.

Use actual repository directories and exclude generated files or dependencies unless targeted. Bound output to useful evidence, then read implementation and tests.

Do not assume automatic hook redirection, an MCP server or permission to send private code to a remote index. Ordinary exploration needs no external provider. Report tool limitations and use the available fallback.
