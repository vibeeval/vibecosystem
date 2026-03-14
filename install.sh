#!/bin/bash
# vibecosystem installer
# Merges ecosystem files without overwriting your existing setup

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
FORCE=false
ADDED=0
SKIPPED=0

# Parse flags
for arg in "$@"; do
  case $arg in
    --force) FORCE=true ;;
    --help|-h)
      echo "Usage: ./install.sh [--force]"
      echo ""
      echo "  --force    Overwrite existing files (default: skip existing)"
      echo ""
      echo "Without --force, only NEW files are added. Your existing agents,"
      echo "skills, hooks, and rules are preserved."
      exit 0
      ;;
  esac
done

echo "vibecosystem installer"
echo "======================"
echo ""
echo "This will install into ~/.claude/:"
echo "  - 119 agents  -> ~/.claude/agents/"
echo "  - 202 skills  -> ~/.claude/skills/"
echo "  - 48 hooks    -> ~/.claude/hooks/"
echo "  - 16 rules    -> ~/.claude/rules/"
echo ""
if [ "$FORCE" = true ]; then
  echo "Mode: OVERWRITE (--force) — existing files will be replaced"
else
  echo "Mode: MERGE (default) — existing files will be preserved"
fi
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || exit 0

# Backup (only in force mode, since merge mode doesn't touch existing files)
if [ "$FORCE" = true ]; then
  if [ -d "$CLAUDE_DIR/agents" ] || [ -d "$CLAUDE_DIR/skills" ]; then
    BACKUP="$CLAUDE_DIR/backup-$(date +%Y%m%d-%H%M%S)"
    echo "Backing up existing files to: $BACKUP"
    mkdir -p "$BACKUP"
    [ -d "$CLAUDE_DIR/agents" ] && cp -r "$CLAUDE_DIR/agents" "$BACKUP/"
    [ -d "$CLAUDE_DIR/skills" ] && cp -r "$CLAUDE_DIR/skills" "$BACKUP/"
    [ -d "$CLAUDE_DIR/hooks" ] && cp -r "$CLAUDE_DIR/hooks" "$BACKUP/"
    [ -d "$CLAUDE_DIR/rules" ] && cp -r "$CLAUDE_DIR/rules" "$BACKUP/"
    echo ""
  fi
fi

# Smart copy function: skip existing files unless --force
smart_copy_file() {
  local src="$1"
  local dest="$2"
  if [ "$FORCE" = true ] || [ ! -e "$dest" ]; then
    cp "$src" "$dest"
    ADDED=$((ADDED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
}

smart_copy_dir() {
  local src="$1"
  local dest="$2"
  if [ "$FORCE" = true ] || [ ! -e "$dest" ]; then
    cp -r "$src" "$dest"
    ADDED=$((ADDED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi
}

# Agents
echo "Installing agents..."
mkdir -p "$CLAUDE_DIR/agents"
for f in "$REPO_DIR/agents/"*.md; do
  name=$(basename "$f")
  smart_copy_file "$f" "$CLAUDE_DIR/agents/$name"
done

# Skills
echo "Installing skills..."
mkdir -p "$CLAUDE_DIR/skills"
for d in "$REPO_DIR/skills/"*/; do
  name=$(basename "$d")
  [ "$name" = "*" ] && continue
  smart_copy_dir "$d" "$CLAUDE_DIR/skills/$name"
done

# Hooks
echo "Installing hooks..."
mkdir -p "$CLAUDE_DIR/hooks/src"
for f in "$REPO_DIR/hooks/src/"*.ts; do
  name=$(basename "$f")
  smart_copy_file "$f" "$CLAUDE_DIR/hooks/src/$name"
done
# Always copy package.json and tsconfig.json (needed for build)
cp "$REPO_DIR/hooks/package.json" "$CLAUDE_DIR/hooks/package.json"
cp "$REPO_DIR/hooks/tsconfig.json" "$CLAUDE_DIR/hooks/tsconfig.json"

# Rules
echo "Installing rules..."
mkdir -p "$CLAUDE_DIR/rules"
for f in "$REPO_DIR/rules/"*.md; do
  name=$(basename "$f")
  smart_copy_file "$f" "$CLAUDE_DIR/rules/$name"
done

# Build hooks
echo ""
echo "Building hooks..."
cd "$CLAUDE_DIR/hooks"
npm install --silent 2>/dev/null
npm run build --silent 2>/dev/null

echo ""
echo "Installation complete!"
echo "  Added:   $ADDED files"
echo "  Skipped: $SKIPPED files (already existed)"
echo ""
echo "  Agents: $(ls "$CLAUDE_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')"
echo "  Skills: $(find "$CLAUDE_DIR/skills/" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
echo "  Hooks:  $(ls "$CLAUDE_DIR/hooks/dist/"*.mjs 2>/dev/null | wc -l | tr -d ' ')"
echo "  Rules:  $(ls "$CLAUDE_DIR/rules/"*.md 2>/dev/null | wc -l | tr -d ' ')"
echo ""
if [ $SKIPPED -gt 0 ]; then
  echo "Tip: Use ./install.sh --force to overwrite existing files."
fi
