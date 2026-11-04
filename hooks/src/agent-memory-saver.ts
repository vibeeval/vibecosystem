/**
 * Agent Memory Saver - PostToolUse:Agent hook
 *
 * Agent tool tamamlandiginda, agent'in ciktisini analiz eder.
 * Onemli ogrenimleri agent'in memory dizinine kaydeder.
 *
 * Kayit stratejisi:
 * - Hata oldu → hatadan ogrenim kaydet
 * - Basarili is → kisa ozet kaydet
 * - Her seferinde degil, belirli sinyaller varsa kaydet
 *
 * Claude Code kaynak kodundan (extractMemories.ts) ilham alinmistir.
 */
import { appendFileSync, constants, fstatSync, ftruncateSync, readSync, writeFileSync } from 'node:fs';
import { readHookInput, hookResponseText } from './shared/hook-input.js';
import { getAgentMemoryScope, getSafeAgentMemoryDir, withAgentMemoryFile, withAgentMemoryLock } from './shared/agent-memory.js';

interface PostToolInput {
  cwd?: string;
  tool_response?: unknown;
  tool_name: string;
  tool_input: {
    subagent_type?: string;
    description?: string;
    prompt?: string;
  };
  tool_output?: string;
  session_id?: string;
}

// Ogrenim kaydetmeyi tetikleyen sinyaller
const LEARNING_SIGNALS = [
  /\bfound\b.*\bbug\b/i,
  /\broot cause\b/i,
  /\bfixed\b.*\bissue\b/i,
  /\bpattern\b.*\bdetected\b/i,
  /\bsecurity\b.*\b(vuln|issue|risk)\b/i,
  /\bperformance\b.*\b(issue|bottleneck|slow)\b/i,
  /\barchitectur(e|al)\b.*\b(decision|change|pattern)\b/i,
  /\bVERDICT:\s*(FAIL|WARN)\b/i,
  /\bCRITICAL\b/i,
  /\bbreaking change\b/i,
  /\bdeprecated\b/i,
  /\bmigrat(e|ion)\b/i,
  /\berror.*handl/i,
  /\brace condition\b/i,
  /\bmemory leak\b/i,
];

// Kisa/ozetlenecek sinyaller (basarili isler icin)
const SUCCESS_SIGNALS = [
  /\bVERDICT:\s*PASS\b/i,
  /\ball tests pass/i,
  /\bbuild succeed/i,
  /\bimplemented\b/i,
  /\brefactored\b/i,
];

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
}

function hasLearningSignal(output: string): boolean {
  return LEARNING_SIGNALS.some(pattern => pattern.test(output));
}

function hasSuccessSignal(output: string): boolean {
  return SUCCESS_SIGNALS.some(pattern => pattern.test(output));
}

/**
 * Ciktidan onemli satirlari extract et (max 500 karakter)
 */
function extractKeyInfo(output: string, maxLen = 500): string {
  const lines = output.split('\n');
  const keyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Onemli satirlari sec
    if (
      /VERDICT|CRITICAL|WARN|FAIL|ERROR|FOUND|PATTERN|DECISION|BUG|FIX|ROOT CAUSE/i.test(trimmed) ||
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('##')
    ) {
      keyLines.push(trimmed);
    }
  }

  let result = keyLines.join('\n');
  if (result.length > maxLen) {
    result = result.substring(0, maxLen) + '...';
  }
  return result || output.substring(0, maxLen);
}

function main() {
  try {
    const input: PostToolInput = readHookInput<PostToolInput>();

    if (input.tool_name !== 'Agent') return;

    const agentType = input.tool_input?.subagent_type;
    const output = hookResponseText(input);
    const description = input.tool_input?.description || '';

    if (!agentType || !output || output.length < 50) return;

    // Sadece onemli sinyaller varsa kaydet
    const hasLearning = hasLearningSignal(output);
    const hasSuccess = hasSuccessSignal(output);

    if (!hasLearning && !hasSuccess) return;

    // Memory dizini olustur
    const scope = getAgentMemoryScope(agentType, input.cwd);
    const memoryDir = getSafeAgentMemoryDir(agentType, scope, input.cwd, true);
    if (!memoryDir) return;

    const timestamp = getTimestamp();
    const keyInfo = extractKeyInfo(output);

    const locked = withAgentMemoryLock(memoryDir, () => {
      // Ogrenimler journal'a ekle (append mode)
      const entry = `
## ${timestamp} - ${description || 'Agent task'}

${keyInfo}

---
`;
      // Keep one verified descriptor through read, append and bounded rewrite.
      const saved = withAgentMemoryFile(memoryDir, 'learnings.md', constants.O_RDWR | constants.O_CREAT | constants.O_APPEND, fd => {
        appendFileSync(fd, entry, 'utf-8');
        // Ordinary appends stay atomic and do not rewrite prior journal content.
        const size = fstatSync(fd).size;
        if (size <= 50000) return;
        const bytes = Buffer.alloc(size);
        let offset = 0;
        while (offset < size) {
          const count = readSync(fd, bytes, offset, size - offset, offset);
          if (count === 0) break;
          offset += count;
        }
        const content = bytes.subarray(0, offset).toString('utf-8');
        if (content.length <= 50000) return;
        const truncated = content.substring(content.length - 40000);
        const firstNewline = truncated.indexOf('\n## ');
        const next = firstNewline > 0 ? truncated.substring(firstNewline) : truncated;
        // All cooperative savers hold the same lock while replacing retained text.
        ftruncateSync(fd, 0);
        writeFileSync(fd, next, 'utf-8');
      });
      if (!saved) return;

      // MEMORY.md index'ini guncelle (yoksa olustur)
      const initialContent = `# ${agentType} Agent Memory

Bu dosya ${agentType} agent'inin kalici bellegidir. Otomatik guncellenir.

## Ogrenimler
- [learnings.md](learnings.md) - Tespit edilen sorunlar, patternler, kararlar
`;
      withAgentMemoryFile(memoryDir, 'MEMORY.md', constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, fd => {
        writeFileSync(fd, initialContent, 'utf-8');
      });
    });
    if (!locked) process.stderr.write('[agent-memory] Optional save skipped: journal lock busy or unsafe. Review .learnings.lock after all writers stop; remove only an abandoned lock.\n');

    // Sessiz basari - stdout'a hicbir sey yazma (hook'u engellemez)
  } catch {
    // Hook hatalari sessiz
  }
}

main();
