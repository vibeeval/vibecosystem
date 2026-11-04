/**
 * Magic Doc Tracker - PostToolUse:Read hook
 *
 * Read tool calistiktan sonra dosya iceriginde "# MAGIC DOC:" header'ini arar.
 * Bulursa dosya yolunu ~/.claude/magic-docs/tracked.json'a kaydeder.
 *
 * Session sonunda magic-doc-updater bu dosyalari gunceller.
 *
 * Claude Code kaynak kodundan (MagicDocs/magicDocs.ts) ilham alinmistir.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { budgetHookOutput } from './shared/context-budget.js';
import { readHookInput, hookResponseText } from './shared/hook-input.js';

interface PostToolInput {
  tool_response?: unknown;
  tool_name: string;
  tool_input: {
    file_path?: string;
  };
  tool_output?: string;
  session_id?: string;
}

interface TrackedDoc {
  path: string;
  title: string;
  instructions?: string;
  firstSeen: string;
  lastSeen: string;
}

const MAGIC_DOC_DIR = join(homedir(), '.claude', 'magic-docs');
const TRACKED_FILE = join(MAGIC_DOC_DIR, 'tracked.json');
const MAGIC_DOC_PATTERN = /^#\s*MAGIC\s+DOC:\s*(.+)$/im;
const INSTRUCTIONS_PATTERN = /^[_*](.+?)[_*]\s*$/m;

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadTracked(): Record<string, TrackedDoc> {
  try {
    if (existsSync(TRACKED_FILE)) {
      return JSON.parse(readFileSync(TRACKED_FILE, 'utf-8'));
    }
  } catch {
    // corrupt file, start fresh
  }
  return {};
}

function saveTracked(tracked: Record<string, TrackedDoc>): void {
  ensureDir(MAGIC_DOC_DIR);
  writeFileSync(TRACKED_FILE, JSON.stringify(tracked, null, 2), 'utf-8');
}

function main() {
  try {
    const input: PostToolInput = readHookInput<PostToolInput>();

    // Sadece Read tool icin calis
    if (input.tool_name !== 'Read') return;

    const filePath = input.tool_input?.file_path;
    const output = hookResponseText(input);

    if (!filePath || !output) return;

    // Magic doc header'i ara
    const match = output.match(MAGIC_DOC_PATTERN);
    if (!match || !match[1]) return;

    const title = match[1].trim();

    // Opsiyonel instructions (header'dan sonraki italik satir)
    let instructions: string | undefined;
    const afterHeader = output.substring((match.index || 0) + match[0].length);
    const instrMatch = afterHeader.match(INSTRUCTIONS_PATTERN);
    if (instrMatch && instrMatch[1]) {
      instructions = instrMatch[1].trim();
    }

    // Tracked listesine ekle
    const tracked = loadTracked();
    const now = new Date().toISOString();

    tracked[filePath] = {
      path: filePath,
      title,
      instructions,
      firstSeen: tracked[filePath]?.firstSeen || now,
      lastSeen: now,
    };

    saveTracked(tracked);

    // Kullaniciya bildir
    const result = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[Magic Doc detected: "${title}" at ${filePath}.]`,
      },
    };
    process.stdout.write(JSON.stringify(budgetHookOutput(result, 'magic-doc-tracker', 'PostToolUse:Read')));
  } catch {
    // Hook hatalari sessiz
  }
}

main();
