#!/bin/bash
# vibecosystem installer for Codex CLI
# Copies skills to ~/.codex/skills/ where Codex auto-discovers them
#
# Usage: ./install-codex.sh [--force]

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CODEX_DIR="$HOME/.codex"
FORCE=false
ADDED=0
SKIPPED=0

for arg in "$@"; do
  case $arg in
    --force) FORCE=true ;;
    --help|-h)
      echo "Usage: ./install-codex.sh [--force]"
      echo ""
      echo "  --force    Overwrite existing skills (default: skip existing)"
      echo ""
      echo "Installs vibecosystem skills to ~/.codex/skills/"
      echo "for use with Codex CLI (OpenAI)."
      exit 0
      ;;
  esac
done

echo "vibecosystem installer for Codex CLI"
echo "====================================="
echo ""

# Check if codex is installed
if command -v codex &> /dev/null; then
  echo "Codex CLI: $(codex --version 2>/dev/null || echo 'found')"
else
  echo "Warning: codex command not found. Install it first:"
  echo "  npm install -g @openai/codex"
  echo ""
  echo "Continuing with skill installation anyway..."
fi

echo ""

# Count skills
SKILL_COUNT=$(find "$REPO_DIR/skills/" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
echo "This will install $SKILL_COUNT skills to ~/.codex/skills/"
echo ""

if [ "$FORCE" = true ]; then
  echo "Mode: OVERWRITE (--force)"
else
  echo "Mode: MERGE (default) -- existing skills preserved"
fi
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || exit 0

# Create directories
mkdir -p "$CODEX_DIR/skills"

# Copy skills
echo ""
echo "Installing skills..."
for d in "$REPO_DIR/skills/"*/; do
  name=$(basename "$d")
  [ "$name" = "*" ] && continue

  if [ "$FORCE" = true ] || [ ! -e "$CODEX_DIR/skills/$name" ]; then
    cp -r "$d" "$CODEX_DIR/skills/$name"
    ADDED=$((ADDED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

# Copy AGENTS.md as instructions reference
if [ "$FORCE" = true ] || [ ! -e "$CODEX_DIR/AGENTS.md" ]; then
  cp "$REPO_DIR/AGENTS.md" "$CODEX_DIR/AGENTS.md"
  echo "Copied AGENTS.md to ~/.codex/"
fi

echo ""
echo "Installation complete!"
echo "  Added:   $ADDED skills"
echo "  Skipped: $SKIPPED skills (already existed)"
echo ""
echo "  Total skills in ~/.codex/skills/: $(find "$CODEX_DIR/skills/" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "Usage:"
echo "  cd your-project"
echo "  codex"
echo '  > "use the coding-standards skill"'
echo ""
if [ $SKIPPED -gt 0 ]; then
  echo "Tip: Use ./install-codex.sh --force to overwrite existing skills."
fi
