#!/bin/bash
# vibecosystem Claude runtime installer.
# The profile manifest is the source of truth; core is intentionally lean.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
export VIBECO_REPO_DIR="$REPO_DIR"

if [[ " $* " == *" --help "* || " $* " == *" -h "* ]]; then
  cat <<'EOF'
Usage: ./install.sh [--profile <name>] [--force] [--prune] [--dry-run] [--non-interactive]

Profiles:
  core          Low-noise default runtime
  quality       Core plus focused edit and verification checks
  context       Core plus targeted context retrieval
  memory        Core plus opt-in memory hooks
  orchestration Core plus explicit multi-agent workflows
  dashboard     Core plus optional local dashboard event capture
  full          All legacy Claude capabilities

Aliases: minimal and smart -> core, all -> full

Options:
  --force            Overwrite existing files, with a backup
  --prune            Reconcile unchanged owned files (enabled by default)
  --dry-run          Show the selected runtime without changing files
  --non-interactive  Do not prompt for confirmation
EOF
  exit 0
fi

exec node "$REPO_DIR/tools/install-runtime.mjs" --claude "$@"
