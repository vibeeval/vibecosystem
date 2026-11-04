/**
 * Passive Learner - PostToolUse hook (Edit|Write)
 * Dosya editleme patternlerini otomatik cikarir
 * Tekrarlayan pattern'lari ~/.claude/instincts.jsonl'e yazar
 */
import { hookResponseText } from './shared/hook-response.js';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { homedir } from 'os';
import { getProjectIdentity } from './shared/project-identity.js';

interface PostToolInput {
  session_id: string;
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
    old_string?: string;
    new_string?: string;
    content?: string;
  };
  tool_output?: string;
  tool_response?: unknown;
}

interface Instinct {
  ts: string;
  session: string;
  type: 'file_pattern' | 'edit_pattern' | 'error_fix';
  pattern: string;
  detail: string;
  confidence: number;
  project?: string;      // proje hash (cross-project learning)
  projectName?: string;  // okunabilir proje ismi
}

// Error pattern'leri (Bash output'undan)
const ERROR_FIX_PATTERNS = [
  { error: /Cannot find module ['"](.+?)['"]/i, label: 'missing-import' },
  { error: /Property ['"](.+?)['"] does not exist/i, label: 'missing-property' },
  { error: /Type ['"](.+?)['"] is not assignable/i, label: 'type-mismatch' },
  { error: /ENOENT.*['"](.+?)['"]/i, label: 'missing-file' },
  { error: /SyntaxError/i, label: 'syntax-error' },
];

function detectFilePattern(filePath: string): Instinct | null {
  const ext = extname(filePath);
  const name = basename(filePath);

  // Test dosyasi olusturma
  if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(name)) {
    return {
      ts: new Date().toISOString(),
      session: '',
      type: 'file_pattern',
      pattern: 'test-file-creation',
      detail: `Test file: ${name} (${ext})`,
      confidence: 0.5,
    };
  }

  // Hook dosyasi
  if (filePath.includes('.claude/hooks')) {
    return {
      ts: new Date().toISOString(),
      session: '',
      type: 'file_pattern',
      pattern: 'hook-development',
      detail: `Hook file: ${name}`,
      confidence: 0.5,
    };
  }

  return null;
}

function detectEditPattern(oldStr: string, newStr: string): Instinct | null {
  // Import ekleme
  if (!oldStr && /^import\s/.test(newStr.trim())) {
    return {
      ts: new Date().toISOString(),
      session: '',
      type: 'edit_pattern',
      pattern: 'add-import',
      detail: newStr.trim().slice(0, 80),
      confidence: 0.3,
    };
  }

  // Error handling ekleme
  if (newStr.includes('try') && newStr.includes('catch') && !oldStr.includes('try')) {
    return {
      ts: new Date().toISOString(),
      session: '',
      type: 'edit_pattern',
      pattern: 'add-error-handling',
      detail: 'try-catch block added',
      confidence: 0.4,
    };
  }

  // Type annotation ekleme
  if (/:\s*(string|number|boolean|Record|Array|Promise)/.test(newStr) &&
      !/:\s*(string|number|boolean|Record|Array|Promise)/.test(oldStr)) {
    return {
      ts: new Date().toISOString(),
      session: '',
      type: 'edit_pattern',
      pattern: 'add-type-annotation',
      detail: 'Type annotation added',
      confidence: 0.3,
    };
  }

  return null;
}

function detectErrorFix(output: string): Instinct | null {
  if (!output) return null;

  for (const { error, label } of ERROR_FIX_PATTERNS) {
    const match = error.exec(output);
    if (match) {
      return {
        ts: new Date().toISOString(),
        session: '',
        type: 'error_fix',
        pattern: label,
        detail: match[0].slice(0, 100),
        confidence: 0.6,
      };
    }
  }

  return null;
}

function main() {
  let raw = '';
  try { raw = readFileSync(0, 'utf-8'); } catch { return; }
  if (!raw) { console.log('{}'); return; }

  let input: PostToolInput;
  try { input = JSON.parse(raw); } catch { console.log('{}'); return; }

  const instincts: Instinct[] = [];
  const sessionId = input.session_id?.slice(0, 8) || 'unknown';

  // Edit tool: pattern tespiti
  if (input.tool_name === 'Edit' && input.tool_input?.file_path) {
    const fileInst = detectFilePattern(input.tool_input.file_path);
    if (fileInst) instincts.push({ ...fileInst, session: sessionId });

    if (input.tool_input.old_string && input.tool_input.new_string) {
      const editInst = detectEditPattern(input.tool_input.old_string, input.tool_input.new_string);
      if (editInst) instincts.push({ ...editInst, session: sessionId });
    }
  }

  // Write tool: file pattern
  if (input.tool_name === 'Write' && input.tool_input?.file_path) {
    const fileInst = detectFilePattern(input.tool_input.file_path);
    if (fileInst) instincts.push({ ...fileInst, session: sessionId });
  }

  // Bash tool: error fix tespiti
  if (input.tool_name === 'Bash') {
    const errInst = detectErrorFix(hookResponseText(input));
    if (errInst) instincts.push({ ...errInst, session: sessionId });
  }

  // Instinct'lere project tag ekle
  if (instincts.length > 0) {
    const identity = getProjectIdentity();
    if (identity) {
      for (const inst of instincts) {
        inst.project = identity.hash;
        inst.projectName = identity.name;
      }
    }

    const logDir = join(homedir(), '.claude');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, 'instincts.jsonl');

    for (const inst of instincts) {
      appendFileSync(logPath, JSON.stringify(inst) + '\n');
    }
  }

  console.log('{}');
}

main();
