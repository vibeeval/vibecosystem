#!/bin/bash
# vibecosystem installer for Codex CLI
# Installs skills into ~/.agents/skills/ and, when requested, the luna worker
# into ~/.codex/agents/. Existing user files are preserved by default.
#
# Usage: ./install-codex.sh [options]

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${HOME:-}" ] || [ "$HOME" = "/" ]; then
  echo "ERROR: HOME must be set to a non-root directory." >&2
  exit 2
fi

HOME_DIR="$HOME"
CODEX_DIR="$HOME_DIR/.codex"
CODEX_AGENT_DIR="$CODEX_DIR/agents"
SKILLS_ROOT="$HOME_DIR/.agents"
SKILLS_DIR="$SKILLS_ROOT/skills"
MANIFEST="$SKILLS_ROOT/.vibecosystem-codex-skills"
BACKUP_ROOT="$SKILLS_ROOT/vibecosystem-backups"
LUNA_SOURCE="$REPO_DIR/.codex/agents/luna-worker.toml"
LUNA_TARGET="$CODEX_AGENT_DIR/luna-worker.toml"

FORCE=false
DRY_RUN=false
PRUNE=true
INSTALL_LUNA_WORKER=false
VALIDATE_LUNA_WORKER=false
VALIDATION_ONLY=false
NON_INTERACTIVE=false
PROFILE="core"
PROFILE_EXPLICIT=false

ADDED=0
UPDATED=0
SKIPPED=0
PRUNED=0
PRESERVED=0
LUNA_INSTALLED=false
LUNA_SKIPPED=false
MANIFEST_DIRTY=false
MANIFEST_BACKED_UP=false
BACKUP_DIR=""

# The shared runtime manifest is the only core allowlist.
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required." >&2; exit 2; }

usage() {
  cat <<'EOF'
Usage: ./install-codex.sh [options]

Install vibecosystem skills for Codex CLI into ~/.agents/skills/.

Options:
  --profile core|full       Install the explicit core allowlist or all skills
  --install-luna-worker     Install .codex/agents/luna-worker.toml globally
  --validate-luna-worker    Validate the canonical luna worker contract
  --dry-run                 Show actions without writing user files
  --prune                   Reconcile unchanged owned skills (enabled by default)
  --force                   Replace existing destinations after making a backup
  --non-interactive         Skip the confirmation prompt
  --help, -h                Show this help

The default is a core, merge-style skill installation. Existing skills are
skipped unless --force is supplied. AGENTS.md is never copied to a global
location; put project instructions in the project that Codex is running in.
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 2
}

is_valid_skill_name() {
  case "$1" in
    ""|.|..|*[!A-Za-z0-9._-]*) return 1 ;;
    *) return 0 ;;
  esac
}

assert_not_symlink() {
  local path="$1"
  if [ -L "$path" ]; then
    die "refusing to follow symlink: $path"
  fi
}

assert_safe_existing_paths() {
  assert_not_symlink "$SKILLS_ROOT"
  assert_not_symlink "$SKILLS_DIR"
  assert_not_symlink "$CODEX_DIR"
  assert_not_symlink "$CODEX_AGENT_DIR"
  assert_not_symlink "$MANIFEST"
  assert_not_symlink "$BACKUP_ROOT"
  assert_not_symlink "$LUNA_TARGET"
}

ensure_directory() {
  local path="$1"
  assert_not_symlink "$path"
  if [ -e "$path" ] && [ ! -d "$path" ]; then
    die "expected a directory but found another file type: $path"
  fi
  if [ "$DRY_RUN" = false ]; then
    mkdir -p "$path"
  fi
}

selected_skill_names() {
  node --input-type=module - "$REPO_DIR" "$PROFILE" <<'JS'
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const repo = process.argv[2];
const { resolveProfile } = await import(pathToFileURL(`${repo}/tools/profile-runtime.mjs`).href);
const selected = resolveProfile(repo, process.argv[3]).skills;
console.log((selected === 'all' ? readdirSync(`${repo}/skills`, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name).sort() : selected).join('\n'));
JS
}

selected_contains() {
  local needle="$1"
  local skill_name
  for skill_name in "${SELECTED_SKILLS[@]}"; do
    [ "$skill_name" = "$needle" ] && return 0
  done
  return 1
}

MANAGED_NAMES=()
MANAGED_HASHES=()

set_manifest_entry() {
  local name="$1"
  local hash="$2"
  local i=0
  while [ "$i" -lt "${#MANAGED_NAMES[@]}" ]; do
    if [ "${MANAGED_NAMES[$i]}" = "$name" ]; then
      MANAGED_HASHES[i]="$hash"
      MANIFEST_DIRTY=true
      return
    fi
    i=$((i + 1))
  done
  MANAGED_NAMES[${#MANAGED_NAMES[@]}]="$name"
  MANAGED_HASHES[${#MANAGED_HASHES[@]}]="$hash"
  MANIFEST_DIRTY=true
}

remove_manifest_entry() {
  local name="$1"
  local i=0
  local found=false
  local new_names=()
  local new_hashes=()
  while [ "$i" -lt "${#MANAGED_NAMES[@]}" ]; do
    if [ "${MANAGED_NAMES[$i]}" = "$name" ]; then
      found=true
    else
      new_names[${#new_names[@]}]="${MANAGED_NAMES[$i]}"
      new_hashes[${#new_hashes[@]}]="${MANAGED_HASHES[$i]}"
    fi
    i=$((i + 1))
  done
  if [ "$found" = true ]; then
    if [ "${#new_names[@]}" -gt 0 ]; then
      MANAGED_NAMES=("${new_names[@]}")
      MANAGED_HASHES=("${new_hashes[@]}")
    else
      MANAGED_NAMES=()
      MANAGED_HASHES=()
    fi
    MANIFEST_DIRTY=true
  fi
}

load_manifest() {
  [ -e "$MANIFEST" ] || return 0
  [ -f "$MANIFEST" ] || die "ownership manifest is not a regular file: $MANIFEST"

  local name
  local hash
  while IFS=$'\t' read -r name hash; do
    [ -n "$name" ] || continue
    case "$name" in
      \#*) continue ;;
    esac
    is_valid_skill_name "$name" || die "invalid skill name in ownership manifest: $name"
    [ -n "$hash" ] || die "missing hash for $name in ownership manifest"
    set_manifest_entry "$name" "$hash"
  done < "$MANIFEST"
  MANIFEST_DIRTY=false
}

HASH_MODE="node"

hash_skill() {
  # Match the historical shasum manifest format without starting one process per file.
  node --input-type=module - "$1" <<'JS'
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const files = [];
function walk(dir, prefix = '.') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const label = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) walk(path, label);
    else if (entry.isFile()) files.push([label, path]);
    else throw new Error(`Unsupported file in skill: ${path}`);
  }
}
walk(root);
files.sort((a, b) => Buffer.compare(Buffer.from(a[0]), Buffer.from(b[0])));
const combined = createHash('sha256');
for (const [label, path] of files) {
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
  combined.update(`${digest}  ${label}\n`);
}
console.log(combined.digest('hex'));
JS
}

ensure_backup_directory() {
  [ "$DRY_RUN" = true ] && return 0
  assert_not_symlink "$SKILLS_ROOT"
  assert_not_symlink "$BACKUP_ROOT"
  if [ -e "$BACKUP_ROOT" ] && [ ! -d "$BACKUP_ROOT" ]; then
    die "backup path is not a directory: $BACKUP_ROOT"
  fi
  mkdir -p "$BACKUP_ROOT"
  if [ -z "$BACKUP_DIR" ]; then
    local stamp
    local candidate
    local suffix=0
    stamp="$(date +%Y%m%d-%H%M%S)"
    candidate="$BACKUP_ROOT/$stamp-$$"
    while [ -e "$candidate" ]; do
      suffix=$((suffix + 1))
      candidate="$BACKUP_ROOT/$stamp-$$-$suffix"
    done
    mkdir -p "$candidate"
    BACKUP_DIR="$candidate"
  fi
}

backup_existing_path() {
  local source="$1"
  local label="$2"
  local candidate
  local suffix=0

  [ -e "$source" ] || return 0
  [ -L "$source" ] && die "refusing to back up symlink: $source"
  if [ "$DRY_RUN" = true ]; then
    echo "  [dry-run] would back up $source under $BACKUP_ROOT"
    return 0
  fi

  ensure_backup_directory
  candidate="$BACKUP_DIR/$label"
  mkdir -p "$(dirname "$candidate")"
  while [ -e "$candidate" ]; do
    suffix=$((suffix + 1))
    candidate="$BACKUP_DIR/$label.$suffix"
  done
  if [ -d "$source" ]; then
    cp -R "$source" "$candidate"
  else
    cp -p "$source" "$candidate"
  fi
}

backup_manifest_if_needed() {
  if [ "$MANIFEST_BACKED_UP" = false ] && [ -e "$MANIFEST" ]; then
    backup_existing_path "$MANIFEST" "manifest"
    MANIFEST_BACKED_UP=true
  fi
}

remove_owned_path() {
  local path="$1"
  case "$path" in
    "$SKILLS_DIR"/*|"$LUNA_TARGET") ;;
    *) die "refusing to remove path outside installer targets: $path" ;;
  esac
  [ -L "$path" ] && die "refusing to remove symlink: $path"
  [ "$path" != "$SKILLS_DIR" ] || die "refusing to remove skills root"
  rm -rf "$path"
}

write_manifest() {
  [ "$MANIFEST_DIRTY" = true ] || return 0
  if [ "$DRY_RUN" = true ]; then
    echo "  [dry-run] would update ownership manifest: $MANIFEST"
    return 0
  fi

  ensure_directory "$SKILLS_ROOT"
  backup_manifest_if_needed
  local temporary="$MANIFEST.tmp.$$"
  {
    printf '# Managed by vibecosystem install-codex.sh; do not edit for ownership tracking.\n'
    local i=0
    while [ "$i" -lt "${#MANAGED_NAMES[@]}" ]; do
      printf '%s\t%s\n' "${MANAGED_NAMES[$i]}" "${MANAGED_HASHES[$i]}"
      i=$((i + 1))
    done
  } > "$temporary"
  chmod 600 "$temporary"
  mv "$temporary" "$MANIFEST"
  MANIFEST_DIRTY=false
}

validate_luna_worker() {
  [ -f "$LUNA_SOURCE" ] || die "canonical luna worker file is missing: $LUNA_SOURCE"
  command -v python3 >/dev/null 2>&1 || die "python3 is required to validate $LUNA_SOURCE"

  PYTHONDONTWRITEBYTECODE=1 python3 - "$LUNA_SOURCE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
expected = {
    "name": "luna_worker",
    "description": "Bounded repository worker for implementation and verification.",
    "developer_instructions": (
        "Work only within the assigned repository and task scope.\n"
        "Inspect the relevant files before changing anything.\n"
        "Do not spawn subagents or background workers unless the user explicitly requests it.\n"
        "Do not run unrelated automation, broad skill scans, or automatic memory recall.\n"
        "Make the smallest complete change, then run focused verification.\n"
        "Stop and ask when the task requires destructive action, external authority, credentials, or an unclear product decision.\n"
        "Return a concise report with result, changed paths, verification performed, and caveats.\n"
    ),
    "model": "gpt-5.6-luna",
    "model_reasoning_effort": "max",
}

try:
    import tomllib
except ModuleNotFoundError:
    expected_text = (
        'name = "luna_worker"\n'
        'description = "Bounded repository worker for implementation and verification."\n'
        'developer_instructions = """\n'
        'Work only within the assigned repository and task scope.\n'
        'Inspect the relevant files before changing anything.\n'
        'Do not spawn subagents or background workers unless the user explicitly requests it.\n'
        'Do not run unrelated automation, broad skill scans, or automatic memory recall.\n'
        'Make the smallest complete change, then run focused verification.\n'
        'Stop and ask when the task requires destructive action, external authority, credentials, or an unclear product decision.\n'
        'Return a concise report with result, changed paths, verification performed, and caveats.\n'
        '"""\n'
        'model = "gpt-5.6-luna"\n'
        'model_reasoning_effort = "max"\n'
    )
    if path.read_text() != expected_text:
        raise SystemExit("LUNA_WORKER_VALID=0: canonical text does not match")
    print("LUNA_WORKER_VALID=1 (canonical text; tomllib unavailable)")
else:
    with path.open("rb") as handle:
        actual = tomllib.load(handle)
    if actual != expected:
        raise SystemExit(f"LUNA_WORKER_VALID=0: parsed contract mismatch: {actual!r}")
    print("LUNA_WORKER_VALID=1")
PY
}

prune_stale_skills() {
  [ "$PRUNE" = true ] || return 0
  if [ ! -f "$MANIFEST" ]; then
    echo "Prune: no vibecosystem ownership manifest found; no skills removed."
    return 0
  fi

  local i=0
  local name
  local expected
  local destination
  local current
  local nested_symlink
  while [ "$i" -lt "${#MANAGED_NAMES[@]}" ]; do
    name="${MANAGED_NAMES[$i]}"
    expected="${MANAGED_HASHES[$i]}"
    if selected_contains "$name"; then
      i=$((i + 1))
      continue
    fi

    destination="$SKILLS_DIR/$name"
    if [ ! -e "$destination" ] && [ ! -L "$destination" ]; then
      remove_manifest_entry "$name"
      continue
    fi
    if [ -L "$destination" ]; then
      echo "Prune: preserving symlink $destination"
      PRESERVED=$((PRESERVED + 1))
      i=$((i + 1))
      continue
    fi
    nested_symlink="$(find "$destination" -type l -print -quit)"
    if [ -n "$nested_symlink" ]; then
      echo "Prune: preserving skill containing symlink $destination"
      PRESERVED=$((PRESERVED + 1))
      i=$((i + 1))
      continue
    fi
    if [ ! -d "$destination" ] || [ "$HASH_MODE" = "none" ] || [ "$expected" = "unverified" ]; then
      echo "Prune: preserving unverified or non-directory skill $destination"
      PRESERVED=$((PRESERVED + 1))
      i=$((i + 1))
      continue
    fi

    current="$(hash_skill "$destination")"
    if [ "$current" != "$expected" ]; then
      echo "Prune: preserving changed skill $destination"
      PRESERVED=$((PRESERVED + 1))
      i=$((i + 1))
      continue
    fi

    if [ "$DRY_RUN" = true ]; then
      echo "  [dry-run] would prune owned skill: $destination"
      PRUNED=$((PRUNED + 1))
      remove_manifest_entry "$name"
      continue
    fi
    backup_existing_path "$destination" "skills/$name"
    remove_owned_path "$destination"
    PRUNED=$((PRUNED + 1))
    remove_manifest_entry "$name"
  done
}

install_skill() {
  local name="$1"
  local source="$REPO_DIR/skills/$name"
  local destination="$SKILLS_DIR/$name"

  if [ -e "$destination" ] || [ -L "$destination" ]; then
    [ -L "$destination" ] && die "refusing to overwrite symlink: $destination"
    local owned_hash=""
    local managed_index=0
    while [ "$managed_index" -lt "${#MANAGED_NAMES[@]}" ]; do
      if [ "${MANAGED_NAMES[$managed_index]}" = "$name" ]; then owned_hash="${MANAGED_HASHES[$managed_index]}"; break; fi
      managed_index=$((managed_index + 1))
    done
    local current_hash=""
    if [ -d "$destination" ] && [ -z "$(find "$destination" -type l -print -quit)" ]; then current_hash="$(hash_skill "$destination")"; fi
    local source_hash
    source_hash="$(hash_skill "$source")"
    if [ -n "$owned_hash" ] && [ "$owned_hash" != unverified ] && [ "$current_hash" = "$owned_hash" ] && [ "$current_hash" = "$source_hash" ]; then
      SKIPPED=$((SKIPPED + 1))
      return 0
    fi
    if [ "$FORCE" = true ] || { [ -n "$owned_hash" ] && [ "$owned_hash" != unverified ] && [ "$current_hash" = "$owned_hash" ]; }; then
      if [ "$DRY_RUN" = true ]; then
        echo "  [dry-run] would back up and replace skill: $destination"
        UPDATED=$((UPDATED + 1))
      else
        backup_existing_path "$destination" "skills/$name"
        remove_owned_path "$destination"
        cp -R "$source" "$destination"
        set_manifest_entry "$name" "$(hash_skill "$destination")"
        UPDATED=$((UPDATED + 1))
      fi
    else
      SKIPPED=$((SKIPPED + 1))
    fi
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "  [dry-run] would install skill: $name"
    ADDED=$((ADDED + 1))
  else
    cp -R "$source" "$destination"
    set_manifest_entry "$name" "$(hash_skill "$destination")"
    ADDED=$((ADDED + 1))
  fi
}

install_skills() {
  local name
  ensure_directory "$SKILLS_DIR"
  echo "Installing profile '$PROFILE' (${#SELECTED_SKILLS[@]} skills) to $SKILLS_DIR"
  for name in "${SELECTED_SKILLS[@]}"; do
    install_skill "$name"
  done
}

install_luna_worker() {
  ensure_directory "$CODEX_AGENT_DIR"
  if [ -e "$LUNA_TARGET" ] || [ -L "$LUNA_TARGET" ]; then
    [ -L "$LUNA_TARGET" ] && die "refusing to overwrite symlink: $LUNA_TARGET"
    if [ "$FORCE" = true ]; then
      if [ "$DRY_RUN" = true ]; then
        echo "  [dry-run] would back up and replace luna worker: $LUNA_TARGET"
      else
        backup_existing_path "$LUNA_TARGET" "codex/agents/luna-worker.toml"
        remove_owned_path "$LUNA_TARGET"
        cp -p "$LUNA_SOURCE" "$LUNA_TARGET"
      fi
      LUNA_INSTALLED=true
    else
      echo "Luna worker already exists; preserving $LUNA_TARGET"
      LUNA_SKIPPED=true
    fi
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "  [dry-run] would install luna worker: $LUNA_TARGET"
  else
    cp -p "$LUNA_SOURCE" "$LUNA_TARGET"
  fi
  LUNA_INSTALLED=true
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --prune)
      PRUNE=true
      ;;
    --install-luna-worker)
      INSTALL_LUNA_WORKER=true
      ;;
    --validate-luna-worker)
      VALIDATE_LUNA_WORKER=true
      ;;
    --non-interactive)
      NON_INTERACTIVE=true
      ;;
    --profile)
      [ "$#" -ge 2 ] || die "--profile requires core or full"
      PROFILE="$2"
      PROFILE_EXPLICIT=true
      shift
      ;;
    --profile=*)
      PROFILE="${1#*=}"
      PROFILE_EXPLICIT=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1 (use --help for usage)"
      ;;
  esac
  shift
done

case "$PROFILE" in
  core|full) ;;
  *) die "unsupported profile '$PROFILE'; choose core or full" ;;
esac

SELECTED_SKILLS=()
SELECTED_SKILL_OUTPUT="$(selected_skill_names)" || die "could not resolve selected skills"
while IFS= read -r skill_name; do
  [ -n "$skill_name" ] || continue
  is_valid_skill_name "$skill_name" || die "invalid skill name in $PROFILE profile: $skill_name"
  [ -d "$REPO_DIR/skills/$skill_name" ] || die "profile $PROFILE references missing skill: $skill_name"
  SELECTED_SKILLS[${#SELECTED_SKILLS[@]}]="$skill_name"
done <<< "$SELECTED_SKILL_OUTPUT"

if [ "$VALIDATE_LUNA_WORKER" = true ] && \
   [ "$INSTALL_LUNA_WORKER" = false ] && \
   [ "$PROFILE_EXPLICIT" = false ] && \
   [ "$FORCE" = false ] && \
   [ "$PROFILE" = core ]; then
  VALIDATION_ONLY=true
fi

if [ "$VALIDATION_ONLY" = true ]; then
  validate_luna_worker
  exit 0
fi

assert_safe_existing_paths
load_manifest

if [ "$VALIDATE_LUNA_WORKER" = true ] || [ "$INSTALL_LUNA_WORKER" = true ]; then
  validate_luna_worker
fi

echo "vibecosystem installer for Codex CLI"
echo "====================================="
echo "Profile: $PROFILE"
echo "Skills target: $SKILLS_DIR"
if [ "$INSTALL_LUNA_WORKER" = true ]; then
  echo "Luna worker target: $LUNA_TARGET"
fi
if [ "$PRUNE" = true ]; then
  echo "Prune: owned, unchanged skills only"
fi
if [ "$DRY_RUN" = true ]; then
  echo "Mode: DRY RUN (no user files will be written)"
elif [ "$FORCE" = true ]; then
  echo "Mode: OVERWRITE (--force) with backups"
else
  echo "Mode: MERGE (existing user files preserved)"
fi
echo "Global AGENTS.md copy: disabled"
echo ""

if [ "$DRY_RUN" = false ] && [ "$NON_INTERACTIVE" = false ]; then
  read -p "Continue? (y/N) " -n 1 -r
  echo
  [[ "$REPLY" =~ ^[Yy]$ ]] || exit 0
fi

if [ "$DRY_RUN" = false ]; then
  ensure_directory "$SKILLS_ROOT"
  if [ "$INSTALL_LUNA_WORKER" = true ]; then
    ensure_directory "$CODEX_DIR"
  fi
fi

prune_stale_skills
install_skills
if [ "$INSTALL_LUNA_WORKER" = true ]; then
  install_luna_worker
fi
write_manifest

echo ""
if [ "$DRY_RUN" = true ]; then
  echo "Dry run complete. No user files were changed."
else
  echo "Installation complete."
fi
echo "  Added:   $ADDED skills"
echo "  Updated: $UPDATED skills"
echo "  Skipped: $SKIPPED skills"
echo "  Pruned:  $PRUNED skills"
echo "  Preserved during prune: $PRESERVED"
if [ "$LUNA_INSTALLED" = true ]; then
  echo "  Luna worker: $LUNA_TARGET"
elif [ "$LUNA_SKIPPED" = true ]; then
  echo "  Luna worker: existing file preserved"
fi
if [ -n "$BACKUP_DIR" ]; then
  echo "  Backup: $BACKUP_DIR"
fi
echo "  Ownership manifest: $MANIFEST"

if [ "$SKIPPED" -gt 0 ] && [ "$FORCE" = false ]; then
  echo "Tip: use --force to replace existing skills after a backup."
fi
