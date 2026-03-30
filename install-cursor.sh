#!/bin/bash
# vibecosystem installer for Cursor IDE
# Copies skills to project and sets up .cursor/rules

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${1:-.}"
ADDED=0
SKIPPED=0

echo "vibecosystem installer for Cursor IDE"
echo "======================================="
echo ""
echo "Target project: $(cd "$TARGET_DIR" && pwd)"
echo ""
echo "This will install:"
echo "  - .cursor/rules/*.mdc  (6 rule files)"
echo "  - AGENTS.md            (project instructions)"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || exit 0

# Copy .cursor/rules
echo ""
echo "Installing Cursor rules..."
mkdir -p "$TARGET_DIR/.cursor/rules"
for f in "$REPO_DIR/.cursor/rules/"*.mdc; do
  name=$(basename "$f")
  if [ ! -e "$TARGET_DIR/.cursor/rules/$name" ]; then
    cp "$f" "$TARGET_DIR/.cursor/rules/$name"
    ADDED=$((ADDED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
done

# Copy AGENTS.md
if [ ! -e "$TARGET_DIR/AGENTS.md" ]; then
  cp "$REPO_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  ADDED=$((ADDED + 1))
  echo "Copied AGENTS.md"
else
  SKIPPED=$((SKIPPED + 1))
fi

# Optionally copy skills to project
echo ""
read -p "Also copy skills to project? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Copying skills..."
  mkdir -p "$TARGET_DIR/.cursor/skills"
  for d in "$REPO_DIR/skills/"*/; do
    name=$(basename "$d")
    [ "$name" = "*" ] && continue
    if [ ! -e "$TARGET_DIR/.cursor/skills/$name" ]; then
      cp -r "$d" "$TARGET_DIR/.cursor/skills/$name"
      ADDED=$((ADDED + 1))
    else
      SKIPPED=$((SKIPPED + 1))
    fi
  done
fi

echo ""
echo "Installation complete!"
echo "  Added:   $ADDED files"
echo "  Skipped: $SKIPPED files (already existed)"
echo ""
echo "  Rules: $(ls "$TARGET_DIR/.cursor/rules/"*.mdc 2>/dev/null | wc -l | tr -d ' ') .mdc files"
echo ""
echo "Usage:"
echo "  Open your project in Cursor IDE"
echo "  Rules will auto-apply based on file patterns"
echo '  Use @ruleName in chat to manually invoke a rule'
