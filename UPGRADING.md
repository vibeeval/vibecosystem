# Upgrading vibecosystem

## Preparing for 3.5.0

3.5.0 is in preparation in this source tree. Check the branch or release you intend to install; `npx vibecosystem` resolves the published npm package, which can differ from a source branch.

Use a clean source checkout and fast-forward updates:

```bash
cd vibecosystem
git status --short
git pull --ff-only
./install.sh --profile core --dry-run
./install.sh --profile core
vibeco effective-config
vibeco doctor
```

A failed remote update stops and preserves the existing checkout. Resolve network, branch or local-change problems before trying again. The installer must not delete a checkout to recover from `git pull` failure.

## Profile changes and ownership

`core` is the default. Memory, learning and orchestration are opt-in profiles. `full` selects the complete catalog; it can increase prompt metadata and hook activity. `minimal`/`smart` alias core and `all` aliases full.

The Claude installer records file ownership and hashes in `~/.claude/vibecosystem-runtime.json`. It reconciles unchanged files that it owns when switching profiles. It preserves unrelated files and local modifications, and backs up replaced content under `~/.claude/backups/`. Review conflicts and the effective state after an upgrade; a preserved local component can differ from the source version. Older manifests may lack hashes, so the installer must preserve uncertain files rather than assume ownership permits deletion.

`--force` explicitly replaces conflicts after backup. `--prune` remains a compatibility flag; normal installs already reconcile unchanged files according to ownership rules. Always inspect a dry run before applying either option to a customized installation.

The registrar replaces this runtime's hook commands while preserving unrelated host configuration. Malformed settings are an error to resolve, not permission to overwrite them. Restart Claude Code so the new registrations take effect.

## Preserve user data

Do not delete `~/.claude/` to reset the runtime. These paths can contain user content:

| Path | Content |
| --- | --- |
| `settings.json`, `CLAUDE.md` | Host permissions and user instructions |
| `projects/`, `memory/`, `palace/` | Project memories and saved context |
| `instincts.jsonl`, `mature-instincts.json` | Learned patterns |
| `canavar/`, `agent-memory/` | Agent history and lessons |
| `rules/` | Both installed and user-created instructions |
| `backups/` | Recovery copies from installer changes |

Ownership applies to recorded files, not an entire shared directory. Store independent backups before large custom migrations.

## Codex

The Codex installer has its own ownership manifest and reconciliation behavior. It installs selected skills under `~/.agents/skills/`; it does not install Claude hooks or copy global `AGENTS.md`.

```bash
./install-codex.sh --profile core --install-luna-worker --dry-run
./install-codex.sh --profile core --install-luna-worker --non-interactive
```

For Codex, normal installs reconcile unchanged, recorded skills absent from the profile. `--force` replaces conflicts after backup and `--prune` remains a compatibility flag. See [docs/codex-setup.md](docs/codex-setup.md) for the full option contract.

## Optional services

A profile selection does not install TLDR, LM Studio, a memory database, Python scripts, MCP servers or provider credentials. The dashboard has its own local dependency. Check [README.md](README.md#optional-integrations-and-data) and [tools/dashboard/README.md](tools/dashboard/README.md) before enabling integrations.

The context budget limits participating hook output. It does not cap complete model token usage. Learned rules and memories should be reviewed for correctness and sensitive data.

## History

For earlier release changes, consult [CHANGELOG.md](CHANGELOG.md). Historical manual copy commands and performance claims are not supported upgrade procedures or benchmark evidence for this version.
