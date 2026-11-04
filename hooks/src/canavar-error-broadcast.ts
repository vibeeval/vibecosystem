/**
 * Canavar Error Broadcast - PostToolUse hook (Bash)
 * Bash ciktisinda hata tespit ederse error-ledger.jsonl'e yazar.
 * Tum agent'lar session basinda bu hatalardan haberdar olur.
 */
import { hookResponseText } from './shared/hook-response.js';
import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { notify } from './shared/notify.js';
import { getCurrentRepo, createIssue } from './shared/github-bridge.js';

interface PostToolInput {
  session_id: string;
  tool_name: string;
  tool_input: {
    command?: string;
    file_path?: string;
    // Agent tool alanları
    subagent_type?: string;
    description?: string;
    prompt?: string;
  };

  // Agent tool çıktısı
  tool_output?: string;
  tool_response?: unknown;
}

interface ErrorEntry {
  ts: string;
  session: string;
  agent_id: string;
  agent_type: string;
  error_type: string;
  error_pattern: string;
  detail: string;
  file: string;
  lesson: string;
}

const ERROR_PATTERNS: Array<{
  regex: RegExp;
  type: string;
  pattern: string;
  lesson: (m: RegExpExecArray) => string;
}> = [
  // Build / TypeScript errors
  {
    regex: /error TS(\d+):\s*(.+)/,
    type: 'build_fail',
    pattern: 'typescript-error',
    lesson: (m) => `TS${m[1]}: ${m[2].slice(0, 80)}`,
  },
  {
    regex: /Cannot find module ['"](.+?)['"]/i,
    type: 'build_fail',
    pattern: 'missing-import',
    lesson: (m) => `${m[1]} import'u eksik`,
  },
  {
    regex: /Property ['"](.+?)['"] does not exist/i,
    type: 'type_error',
    pattern: 'missing-property',
    lesson: (m) => `'${m[1]}' property'si yok`,
  },
  {
    regex: /Type ['"](.+?)['"] is not assignable to type ['"](.+?)['"]/i,
    type: 'type_error',
    pattern: 'type-mismatch',
    lesson: (m) => `${m[1]} → ${m[2]} atanamaz`,
  },
  // Test failures
  {
    regex: /FAIL\s+(.+?)$/m,
    type: 'test_fail',
    pattern: 'test-failure',
    lesson: (m) => `Test FAIL: ${m[1].trim().slice(0, 80)}`,
  },
  {
    regex: /(\d+) failed/i,
    type: 'test_fail',
    pattern: 'test-failure',
    lesson: (m) => `${m[1]} test basarisiz`,
  },
  // Runtime errors
  {
    regex: /TypeError:\s*(.+)/,
    type: 'runtime_error',
    pattern: 'type-runtime-error',
    lesson: (m) => `TypeError: ${m[1].slice(0, 80)}`,
  },
  {
    regex: /ReferenceError:\s*(.+)/,
    type: 'runtime_error',
    pattern: 'reference-error',
    lesson: (m) => `ReferenceError: ${m[1].slice(0, 80)}`,
  },
  {
    regex: /SyntaxError:\s*(.+)/,
    type: 'build_fail',
    pattern: 'syntax-error',
    lesson: (m) => `SyntaxError: ${m[1].slice(0, 80)}`,
  },
  {
    regex: /(?:ENOENT|no such file|ENOENT: no such file or directory)[,:\s]+(?:open|stat|lstat|access|unlink|rename|read)?\s*['"](.+?)['"]/i,
    type: 'runtime_error',
    pattern: 'missing-file',
    lesson: (m) => `Dosya bulunamadi: ${m[1]}`,
  },
  // Go errors
  {
    regex: /undefined:\s*(\w+)/,
    type: 'build_fail',
    pattern: 'go-undefined',
    lesson: (m) => `${m[1]} tanimlanmamis`,
  },
  // Python errors
  {
    regex: /ModuleNotFoundError:\s*No module named ['"](.+?)['"]/,
    type: 'runtime_error',
    pattern: 'python-missing-module',
    lesson: (m) => `Python modul eksik: ${m[1]}`,
  },
];

function extractFile(output: string, command?: string): string {
  // Dosya adini hata ciktisindan cikar
  const fileMatch = output.match(/(?:(?:\/|[A-Z]:\\)[\w\/.\\-]+\.\w+)/);
  if (fileMatch) return fileMatch[0].replace(/\\/g, '/');
  // Command'dan cikar
  if (command) {
    const cmdFile = command.match(/(?:(?:\/|[A-Z]:\\)[\w\/.\\-]+\.\w+)/);
    if (cmdFile) return cmdFile[0].replace(/\\/g, '/');
  }
  return 'unknown';
}

function main() {
  let raw = '';
  try { raw = readFileSync(0, 'utf-8'); } catch { return; }
  if (!raw) { console.log('{}'); return; }

  let input: PostToolInput;
  try { input = JSON.parse(raw); } catch { console.log('{}'); return; }

  // Agent tool mu yoksa Bash tool mu - buna göre çıktıyı ve agent_type'ı belirle
  const isAgentTool = input.tool_name === 'Agent';

  // Agent tool'u için: subagent_type'ı agent kimliği olarak kullan
  // Bash tool'u için: ortam değişkenlerinden al (main veya mevcut subagent)
  const sessionId = input.session_id?.slice(0, 8) || 'unknown';
  const agentId = isAgentTool
    ? (input.tool_input?.subagent_type || 'unknown-agent')
    : (process.env.CLAUDE_AGENT_ID || 'main');
  const agentType = isAgentTool
    ? (input.tool_input?.subagent_type || 'unknown-agent')
    : (process.env.CLAUDE_AGENT_TYPE || 'main');

  const output = hookResponseText(input);

  if (!output || output.length < 10) {
    console.log('{}');
    return;
  }

  const errors: ErrorEntry[] = [];

  for (const ep of ERROR_PATTERNS) {
    const match = ep.regex.exec(output);
    if (match) {
      errors.push({
        ts: new Date().toISOString(),
        session: sessionId,
        agent_id: agentId,
        agent_type: agentType,
        error_type: ep.type,
        error_pattern: ep.pattern,
        detail: match[0].slice(0, 200),
        // Agent tool için dosya adını çıktıdan çıkar; Bash için komuttan da bak
        file: extractFile(output, isAgentTool ? undefined : input.tool_input?.command),
        lesson: ep.lesson(match),
      });
    }
  }

  // Tum hatalari kaydet (main dahil - feedback loop icin gerekli)
  if (errors.length > 0) {
    const canavarDir = join(homedir(), '.claude', 'canavar');
    if (!existsSync(canavarDir)) mkdirSync(canavarDir, { recursive: true });
    const ledgerPath = join(canavarDir, 'error-ledger.jsonl');

    for (const err of errors) {
      appendFileSync(ledgerPath, JSON.stringify(err) + '\n');
    }

    // Kritik hatalarda masaustu bildirimi
    const criticalErrors = errors.filter(e => e.error_type === 'build_fail' || e.error_type === 'runtime_error');
    if (criticalErrors.length > 0) {
      notify('Hizir: Hata Tespit', `${criticalErrors.length} kritik hata: ${criticalErrors[0].error_pattern}`, 'critical');
    }

    // 3+ kez tekrarlayan hata pattern'i varsa opsiyonel GitHub issue olustur
    try {
      const ledgerPath2 = join(homedir(), '.claude', 'canavar', 'error-ledger.jsonl');
      if (existsSync(ledgerPath2)) {
        const allLines = readFileSync(ledgerPath2, 'utf-8').split('\n').filter(l => l.trim());
        const patternCounts = new Map<string, number>();
        for (const line of allLines) {
          try {
            const entry = JSON.parse(line);
            patternCounts.set(entry.error_pattern, (patternCounts.get(entry.error_pattern) || 0) + 1);
          } catch { /* skip */ }
        }
        for (const err of errors) {
          const count = patternCounts.get(err.error_pattern) || 0;
          if (count >= 3 && getCurrentRepo()) {
            createIssue(
              `[Canavar] Tekrarlayan hata: ${err.error_pattern} (${count}x)`,
              `## Hata Detayi\n\n- **Pattern:** ${err.error_pattern}\n- **Tip:** ${err.error_type}\n- **Tekrar:** ${count} kez\n- **Son ders:** ${err.lesson}\n- **Dosya:** ${err.file}\n\n_Otomatik olusturuldu by Canavar_`,
              ['bug', 'canavar']
            );
            break; // Session basina max 1 issue burada
          }
        }
      }
    } catch { /* GitHub issue opsiyonel, hata olursa sessizce devam */ }
  }

  console.log('{}');
}

main();
