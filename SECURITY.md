# Security policy

Agent memory accepts regular files under validated user/project/local roots. Symbolic links in memory entries, metadata and their directory descendants are rejected. PreCompact similarly validates ledger/handoff descendants and uses regular no-follow file descriptors. Trusted HOME/project anchors are resolved first to support normal platform aliases. Cooperative savers serialize append and retention. A busy or abandoned `.learnings.lock` produces a diagnostic and skips the optional save after a bounded wait; stop all writers and review the lock before manual recovery. This does not provide a sandbox against hostile concurrent filesystem changes by another process with the same user privileges.

## Supported versions

Security fixes target the current 3.x source line. Version 3.5.0 is in preparation; a version string in this tree does not mean a published package or release exists. Earlier releases may lack fixes documented in [CHANGELOG.md](CHANGELOG.md).

## Report a vulnerability

Please avoid posting exploitable details or secrets in a public issue. Contact **security@vibeeval.com**, or contact [@vibeeval](https://x.com/vibeeval) privately to arrange a report.

Include the affected commit or version, operating system, selected profile, minimal reproduction, expected behavior and potential impact. Use synthetic credentials and temporary home directories. Do not include real keys, private source code or personal memory files. Disclosure and fixes depend on severity and maintainer availability.

## Trust boundaries

Hooks run as local processes with the user's privileges. Agent prompts and skill instructions are not a sandbox. Only install extensions and configure services that you trust.

The credential hook is a best-effort filter for supported tool paths and recognizable shell access patterns. It cannot prove that an arbitrary shell program, obfuscated command, indirect interpreter access, race or third-party tool cannot read a secret. Enforce host permissions, use an operating-system sandbox and provide narrowly scoped credentials. Passing the guard is not proof that an action is safe.

The installer writes to the selected host directories, records owned files and creates backups before replacing content. Existing malformed settings must be repaired explicitly; they must not be silently replaced. Update failures must preserve the checkout and local changes. Ownership manifests are not authorization to remove unrelated files or user memories.

The optional dashboard binds to loopback and checks host/origin headers, including WebSocket upgrades. This reduces browser-origin access to local data. It does not isolate the dashboard from other local processes running as the same user. Do not expose or reverse-proxy it to a network without an explicit authentication and deployment design.

## Data and integrations

Local stores and logs may contain prompts, code excerpts, tool responses, file paths, agent errors and learned lessons. Review `~/.claude/` data before sharing it. Backups can retain replaced sensitive content.

Optional provider, MCP, compiler-assistance and extraction integrations may contact configured services. Braintrust extraction requires `VIBECO_BRAINTRUST_ANALYSIS=1` as well as its API key and script. The presence of a provider key alone should not enable external learning. Hooks that mutate GitHub state require `VIBECO_GITHUB_AUTOMATION=1`; normal lifecycle events must not implicitly grant external write authority. Review destinations and data handling before enabling an integration.

Memory consolidation and learned rules use heuristics. They may preserve incorrect or untrusted material. Review new lessons and promoted instructions before using them in sensitive projects.

## Contributor checks

- Use subprocess argument arrays for tool-controlled values; avoid interpolating them into shell command strings.
- Validate event input and paths. Keep permission decisions intact when optional context is omitted.
- Exercise canonical stdin events and emitted ESM bundles in isolated fixtures.
- Preserve user configuration, modified files and unowned content during install/profile changes.
- Test browser origins for both HTTP and WebSocket endpoints; local CORS policy alone does not protect upgrades.
- Do not commit keys, tokens, private logs or personal installation data.

Hook implementation, installers, credential handling, dashboard boundaries and extension-controlled prompt injection are in scope. Report defects in the coding host itself to that host's maintainers.
