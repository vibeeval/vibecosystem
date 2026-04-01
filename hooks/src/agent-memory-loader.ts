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
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import { homedir } from 'os';

interface PreToolInput {
  tool_name: string;
  tool_input: {
    subagent_type?: string;
    prompt?: string;
    description?: string;
  };
}

type AgentMemoryScope = 'user' | 'project' | 'local';

const CLAUDE_HOME = join(homedir(), '.claude');
const MAX_MEMORY_SIZE = 8000; // karakterde max inject boyutu
const MAX_FILES = 10; // max memory dosyasi

/**
 * Agent type'i dizin adi icin sanitize et
 */
function sanitizeAgentType(agentType: string): string {
  return agentType.replace(/[:/\\]/g, '-').replace(/\s+/g, '-').toLowerCase();
}

/**
 * Agent memory dizinini dondur
 */
function getAgentMemoryDir(agentType: string, scope: AgentMemoryScope): string {
  const dirName = sanitizeAgentType(agentType);
  switch (scope) {
    case 'user':
      return join(CLAUDE_HOME, 'agent-memory', dirName);
    case 'project':
      return join(process.cwd(), '.claude', 'agent-memory', dirName);
    case 'local':
      return join(process.cwd(), '.claude', 'agent-memory-local', dirName);
  }
}

/**
 * Bir dizindeki memory dosyalarini tara ve iceriklerini topla
 */
function scanMemoryDir(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .slice(0, MAX_FILES);

    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (stat.isFile() && stat.size > 0 && stat.size < 50000) {
          const content = readFileSync(filePath, 'utf-8').trim();
          if (content) {
            results.push(`### ${file}\n${content}`);
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

/**
 * Agent icin frontmatter'dan memory scope'unu oku
 * Yoksa undefined dondur (memory kaydedilmez)
 */
function getAgentMemoryScope(agentType: string): AgentMemoryScope | undefined {
  const agentDir = join(CLAUDE_HOME, 'agents');
  const agentFile = join(agentDir, `${agentType}.md`);

  if (!existsSync(agentFile)) return undefined;

  try {
    const content = readFileSync(agentFile, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return undefined;

    const memoryMatch = frontmatterMatch[1].match(/^memory:\s*(.+)$/m);
    if (!memoryMatch) return undefined;

    const scope = memoryMatch[1].trim().toLowerCase();
    if (scope === 'user' || scope === 'project' || scope === 'local') {
      return scope as AgentMemoryScope;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function main() {
  try {
    const input: PreToolInput = JSON.parse(process.argv[2] || '{}');

    // Sadece Agent tool icin calis
    if (input.tool_name !== 'Agent') return;

    const agentType = input.tool_input?.subagent_type;
    if (!agentType) return;

    // Agent'in memory scope'unu kontrol et
    const scope = getAgentMemoryScope(agentType);

    // Memory scope tanimli degilse, default olarak user scope'ta bak
    // (bazi built-in agent'larda frontmatter olmayabilir)
    const effectiveScope = scope || 'user';
    const memoryDir = getAgentMemoryDir(agentType, effectiveScope);

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
Bu memory'yi guncelle: Yeni ogrenimler varsa ~/.claude/agent-memory/${sanitizeAgentType(agentType)}/ dizinine yaz.
Memory guncelleme zorunlu DEGiL - sadece gercekten yeni ve degerli bilgi varsa kaydet.`;

    const result = {
      additionalContext: context,
    };

    process.stdout.write(JSON.stringify(result));
  } catch {
    // Hook hatalari sessiz
  }
}

main();
