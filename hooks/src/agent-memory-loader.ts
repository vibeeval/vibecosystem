/**
 * Agent Memory Loader - PreToolUse:Agent hook
 *
 * Agent tool cagrildiginda, o agent icin kalici bellek dosyasini
 * additionalContext olarak inject eder.
 *
 * Claude Code kaynak kodundan (agentMemory.ts) ilham alinmistir.
 * 3 scope destekler: user, project, local
 *
 * Dizin yapisi:
 *   user:    ~/.claude/agent-memory/<agent-type>/MEMORY.md
 *   project: <cwd>/.claude/agent-memory/<agent-type>/MEMORY.md
 *   local:   <cwd>/.claude/agent-memory-local/<agent-type>/MEMORY.md
 */
import { constants, fstatSync, readFileSync, readdirSync } from 'node:fs';
import { budgetHookOutput } from './shared/context-budget.js';
import { readHookInput } from './shared/hook-input.js';
import { getAgentMemoryScope, getSafeAgentMemoryDir, isSafeAgentMemoryDir, withAgentMemoryFile, type AgentMemoryDirectory } from './shared/agent-memory.js';

interface PreToolInput {
  cwd?: string;
  tool_name: string;
  tool_input: {
    subagent_type?: string;
    prompt?: string;
    description?: string;
  };
}

const MAX_MEMORY_SIZE = 8000;
const MAX_FILES = 10;

/**
 * Bir dizindeki memory dosyalarini tara ve iceriklerini topla
 */
function scanMemoryDir(dir: AgentMemoryDirectory): string[] {
  if (!isSafeAgentMemoryDir(dir)) return [];

  const results: string[] = [];
  try {
    const files = readdirSync(dir.path)
      .filter(f => f.endsWith('.md'))
      .slice(0, MAX_FILES);

    for (const file of files) {
      withAgentMemoryFile(dir, file, constants.O_RDONLY, fd => {
        const stat = fstatSync(fd);
        if (stat.isFile() && stat.size > 0 && stat.size < 50000) {
          const content = readFileSync(fd, 'utf-8').trim();
          if (content) {
            results.push(`### ${file}\n${content}`);
          }
        }
      });
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

function main() {
  try {
    const input: PreToolInput = readHookInput<PreToolInput>();

    // Sadece Agent tool icin calis
    if (input.tool_name !== 'Agent') return;

    const agentType = input.tool_input?.subagent_type;
    if (!agentType) return;

    // Agent'in memory scope'unu kontrol et
    const effectiveScope = getAgentMemoryScope(agentType, input.cwd);
    const memoryDir = getSafeAgentMemoryDir(agentType, effectiveScope, input.cwd);
    if (!memoryDir) return;

    // Memory dosyalarini tara
    const memories = scanMemoryDir(memoryDir);
    if (memories.length === 0) return;

    // Toplam boyut kontrolu
    let combined = memories.join('\n\n');
    if (combined.length > MAX_MEMORY_SIZE) {
      combined = combined.substring(0, MAX_MEMORY_SIZE) + '\n\n[... truncated]';
    }

    const context = `## Agent Persistent Memory (${agentType}, scope: ${effectiveScope})

Bu agent'in onceki session'lardan biriktirdigi kalici bellek:

${combined}

---
Bu memory'yi guncelle: Yeni ogrenimler varsa ${memoryDir.path}/ dizinine yaz.
Memory guncelleme zorunlu DEGiL - sadece gercekten yeni ve degerli bilgi varsa kaydet.`;

    const result = {
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context },
    };

    process.stdout.write(JSON.stringify(budgetHookOutput(result, 'agent-memory-loader', 'PreToolUse:Agent')));
  } catch {
    // Hook hatalari sessiz
  }
}

main();
