---
name: search-router
description: Select the smallest reliable search for a filename, symbol, structure, or behavior.
user-invocable: false
---

# Search Router

Choose scope before tool. Use `rg --files` with globs for filenames and scoped `rg -n` or built-in search for identifiers. Read matching code and relevant callers to understand behavior.

For structural changes use an installed AST tool when syntax matters. For conceptual questions follow entry points first; use a current semantic index only when it helps resolve the query.

Batch independent searches. Bound output by path, language and context; refine broad matches rather than dumping the same tree. Read enough to preserve semantics and errors.

Optional `tldr`, Morph, LEANN and MCP are not core dependencies. Fall back to built-in tools without installing services or changing profiles. Do not claim universal savings or speed percentages; cost depends on query and output.
