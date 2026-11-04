#!/bin/bash
# Usage: curl -fsSL https://raw.githubusercontent.com/vibeeval/vibecosystem/main/install-remote.sh | bash -s -- --profile core
set -euo pipefail

if [ -z "${HOME:-}" ] || [ "$HOME" = "/" ]; then
  echo "Error: HOME must be a non-root directory." >&2
  exit 1
fi
INSTALL_DIR="$HOME/.vibecosystem"
REPO_URL="https://github.com/vibeeval/vibecosystem.git"
INSTALL_ARGS=("$@")
DRY_RUN=false
REQUESTED_PROFILE=core

usage() {
  echo 'Usage: install-remote.sh [--profile NAME] [--dry-run] [--force] [--prune] [--non-interactive]'
}
# Validate before cloning or updating. An explicit invocation never prompts.
while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile)
      [ "$#" -ge 2 ] || { echo 'Error: --profile requires a value.' >&2; exit 1; }
      REQUESTED_PROFILE="$2"
      shift
      ;;
    --profile=*) REQUESTED_PROFILE="${1#*=}" ;;
    --dry-run) DRY_RUN=true ;;
    --force|--prune|--non-interactive) ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Error: unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done
case "$REQUESTED_PROFILE" in
  core|quality|context|memory|orchestration|dashboard|full|frontend|backend|fullstack|devops|minimal|smart|all) ;;
  *) echo "Error: unknown profile: $REQUESTED_PROFILE" >&2; exit 1 ;;
esac

echo ''
echo '  vibecosystem remote installer'
echo '  =============================='
echo ''
command -v git >/dev/null 2>&1 || { echo 'Error: git is required.' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo 'Error: Node.js is required (https://nodejs.org/).' >&2; exit 1; }
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "Error: Node.js >= 18 required (you have $(node -v))" >&2
  exit 1
fi

if [ -e "$INSTALL_DIR" ] || [ -L "$INSTALL_DIR" ]; then
  if [ -L "$INSTALL_DIR" ] || [ ! -d "$INSTALL_DIR/.git" ]; then
    echo "Error: $INSTALL_DIR is not a managed Git checkout. Preserving it." >&2
    exit 1
  fi
  origin="$(git -C "$INSTALL_DIR" remote get-url origin)"
  case "$origin" in
    "$REPO_URL"|"https://github.com/vibeeval/vibecosystem"|"git@github.com:vibeeval/vibecosystem.git") ;;
    *) echo "Error: unexpected origin at $INSTALL_DIR. Preserving it." >&2; exit 1 ;;
  esac
  if [ "$DRY_RUN" = false ]; then
    if [ -n "$(git -C "$INSTALL_DIR" status --porcelain)" ]; then
      echo "Error: $INSTALL_DIR has local changes. Commit or back them up before updating." >&2
      exit 1
    fi
    echo 'Updating existing installation...'
    if ! git -C "$INSTALL_DIR" pull --ff-only; then
      echo 'Error: update failed. Existing checkout and local files were preserved; retry when Git is ready.' >&2
      exit 1
    fi
  else
    echo 'dry-run: skipping Git updates; inspecting the existing checkout.'
  fi
elif [ "$DRY_RUN" = true ]; then
  echo "dry-run: would clone $REPO_URL into $INSTALL_DIR and install profile $REQUESTED_PROFILE."
  echo 'No checkout or runtime files were changed.'
  exit 0
else
  echo 'Cloning vibecosystem...'
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

if [ "${#INSTALL_ARGS[@]}" -eq 0 ]; then
  echo ''
  echo 'Choose a profile:'
  echo '  1) core          Low-noise default runtime'
  echo '  2) frontend      React/Next.js focused'
  echo '  3) backend       API/DB/infra focused'
  echo '  4) fullstack     Frontend + backend'
  echo '  5) devops        CI/CD/cloud focused'
  echo '  6) orchestration Explicit multi-agent workflows'
  echo '  7) full          Every legacy capability'
  if [ -t 0 ]; then read -r -p 'Select [1-7, default 1]: ' CHOICE; else CHOICE=1; fi
  case "$CHOICE" in
    2) REQUESTED_PROFILE=frontend ;;
    3) REQUESTED_PROFILE=backend ;;
    4) REQUESTED_PROFILE=fullstack ;;
    5) REQUESTED_PROFILE=devops ;;
    6) REQUESTED_PROFILE=orchestration ;;
    7) REQUESTED_PROFILE=full ;;
    *) REQUESTED_PROFILE=core ;;
  esac
  INSTALL_ARGS=(--profile "$REQUESTED_PROFILE" --prune --non-interactive)
fi

cd "$INSTALL_DIR"
bash install.sh "${INSTALL_ARGS[@]}"
if [ "$DRY_RUN" = true ]; then exit 0; fi

echo ''
echo 'Done! vibecosystem is ready.'
echo '  vibeco help       Show all commands'
echo '  vibeco stats      Ecosystem statistics'
echo '  vibeco doctor     Health check'
echo '  vibeco dashboard  Start optional monitoring UI'
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo 'Add ~/.local/bin to your shell PATH to run vibeco.' ;;
esac
