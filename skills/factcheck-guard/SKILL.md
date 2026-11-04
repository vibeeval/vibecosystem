---
name: factcheck-guard
description: Verify claims about code behavior, existence, or absence with the relevant implementation and execution evidence.
---

# Verify Code Claims

Use search to locate evidence, then read the relevant implementation and callers. A matching name or comment does not establish live behavior.

For a behavior claim, follow the applicable branch, configuration, state and errors. Exercise the public entry point when runtime behavior matters. Distinguish source inspection from a reproduced result; cite the supporting location and the scope of any test.

For absence claims, inspect likely entry points and alternate names before concluding. Prefer a bounded statement such as "no registration in this manifest" over an unproven repository-wide claim.

State uncertainty candidly when evidence is missing. Do not invent percentages, force confidence labels into every sentence, or imply tests ran because their source exists. Prioritize evidence that resolves the user's decision; avoid ritual searches and full-file reads unrelated to it.
