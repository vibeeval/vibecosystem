---
name: explore
description: Map an unfamiliar codebase or trace a focused behavior without editing the project.
---

# Explore

Use `/explore [quick|deep|architecture] [--focus <area>] [--entry <symbol>] [--output doc|handoff]`. Default to a quick map and honor a deeper requested scope.

Begin with instructions, manifests, README and filenames. Use `rg --files` and scoped symbol searches, then read entry points and callers. Fall back to available file/search tools if ripgrep is absent.

- **Quick:** Identify stack, entry points, key directories, test commands and main files for the requested area.
- **Deep:** Trace input, state changes, output, errors, dependencies, tests and configuration.
- **Architecture:** Map boundaries, import directions, shared state and external integrations. Confirm cycles from code.

Optional AST, `tldr` or semantic tools can help when installed and current. Raw code is the source of truth. Do not install tools, build indexes or read the entire repository by default. An installed Claude `scout` can answer an independent question; Codex keeps parent settings.

Return a concise map with locations, verified facts, uncertainties and next steps. Write an artifact only when requested, using the supplied destination or repository convention. Exploration is read-only; do not start memory, learning or swarm automation.
