/**
 * Smart Memory Recall - UserPromptSubmit hook
 *
 * Memory dosyalarinin frontmatter'ini tarar, kullanici query'sine
 * en alakali olanlari secer ve additionalContext olarak inject eder.
 *
 * Claude Code kaynak kodundan (findRelevantMemories.ts, memoryScan.ts)
 * ilham alinmistir.
 *
 * Fark: Claude Code LLM (Sonnet) ile secim yapar, biz keyword matching
 * + frontmatter scoring ile yapariz (hiz icin). LLM olmadan da iyi calisir.
 *
 * Tarama alanlari:
 * 1. ~/.claude/projects/<project>/memory/*.md (proje memory)
 * 2. ~/.claude/agent-memory/**\/*.md (agent memory)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

interface UserPromptSubmitInput {
  session_id: string;
  prompt: string;
  cwd: string;
}

interface MemoryHeader {
  filename: string;
  filePath: string;
  name: string;
  description: string;
  type: string;
  mtimeMs: number;
  score: number;
}

const CLAUDE_HOME = join(homedir(), '.claude');
const MAX_RESULTS = 3;
const MAX_CONTEXT_SIZE = 4000;
const FRONTMATTER_MAX_BYTES = 2000;

/**
 * Frontmatter'dan name, description, type cek
 */
function parseFrontmatter(content: string): { name: string; description: string; type: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '', type: '' };

  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  const typeMatch = fm.match(/^type:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || '',
    type: typeMatch?.[1]?.trim() || '',
  };
}

/**
 * Dizini tara, .md dosyalarinin frontmatter'ini oku
 */
function scanDir(dir: string): MemoryHeader[] {
  if (!existsSync(dir)) return [];

  const results: MemoryHeader[] = [];
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');

    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (!stat.isFile() || stat.size === 0) continue;

        // Sadece ilk 2KB oku (frontmatter icin yeterli)
        const fd = require('fs').openSync(filePath, 'r');
        const buf = Buffer.alloc(Math.min(FRONTMATTER_MAX_BYTES, stat.size));
        require('fs').readSync(fd, buf, 0, buf.length, 0);
        require('fs').closeSync(fd);

        const content = buf.toString('utf-8');
        const fm = parseFrontmatter(content);

        results.push({
          filename: file,
          filePath,
          name: fm.name || file.replace('.md', ''),
          description: fm.description,
          type: fm.type,
          mtimeMs: stat.mtimeMs,
          score: 0,
        });
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }
  return results;
}

/**
 * Tum memory dizinlerini tara
 */
function scanAllMemories(): MemoryHeader[] {
  const headers: MemoryHeader[] = [];

  // 1. Proje memory'leri
  const projectsDir = join(CLAUDE_HOME, 'projects');
  if (existsSync(projectsDir)) {
    try {
      for (const proj of readdirSync(projectsDir)) {
        const memDir = join(projectsDir, proj, 'memory');
        headers.push(...scanDir(memDir));
      }
    } catch { /* skip */ }
  }

  // 2. Agent memory'leri
  const agentMemDir = join(CLAUDE_HOME, 'agent-memory');
  if (existsSync(agentMemDir)) {
    try {
      for (const agent of readdirSync(agentMemDir)) {
        const dir = join(agentMemDir, agent);
        if (existsSync(dir) && statSync(dir).isDirectory()) {
          headers.push(...scanDir(dir));
        }
      }
    } catch { /* skip */ }
  }

  return headers;
}

/**
 * Query'ye gore memory'leri skorla
 * Basit ama etkili: keyword matching + recency bonus
 */
function scoreMemories(headers: MemoryHeader[], query: string): MemoryHeader[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (queryWords.length === 0) return [];

  for (const header of headers) {
    let score = 0;
    const searchText = `${header.name} ${header.description} ${header.filename} ${header.type}`.toLowerCase();

    // Keyword match (her eslesen kelime icin +10)
    for (const word of queryWords) {
      if (searchText.includes(word)) {
        score += 10;
      }
    }

    // Exact phrase match bonus (+20)
    if (searchText.includes(queryLower.substring(0, 30))) {
      score += 20;
    }

    // Filename match bonus (+15)
    const filenameLower = header.filename.toLowerCase().replace('.md', '').replace(/[-_]/g, ' ');
    for (const word of queryWords) {
      if (filenameLower.includes(word)) {
        score += 15;
      }
    }

    // Type match bonus (feedback/project daha degerli)
    if (header.type === 'feedback') score += 5;
    if (header.type === 'project') score += 3;

    // Recency bonus (son 7 gunde degistirilmis: +5, son 30 gun: +2)
    const ageMs = Date.now() - header.mtimeMs;
    if (ageMs < 7 * 24 * 60 * 60 * 1000) score += 5;
    else if (ageMs < 30 * 24 * 60 * 60 * 1000) score += 2;

    header.score = score;
  }

  return headers
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

/**
 * Secilen memory dosyalarinin iceriklerini oku
 */
function loadMemoryContents(selected: MemoryHeader[]): string {
  const parts: string[] = [];
  let totalSize = 0;

  for (const mem of selected) {
    try {
      let content = readFileSync(mem.filePath, 'utf-8').trim();

      // Boyut kontrolu
      if (totalSize + content.length > MAX_CONTEXT_SIZE) {
        const remaining = MAX_CONTEXT_SIZE - totalSize;
        if (remaining < 200) break;
        content = content.substring(0, remaining) + '\n[... truncated]';
      }

      parts.push(`### ${mem.name} (${mem.type || 'unknown'}, score: ${mem.score})\n*Source: ${mem.filename}*\n\n${content}`);
      totalSize += content.length;
    } catch {
      // skip unreadable
    }
  }

  return parts.join('\n\n---\n\n');
}

function readStdin(): string {
  return readFileSync(0, 'utf-8');
}

async function main() {
  const input: UserPromptSubmitInput = JSON.parse(readStdin());

  // Subagent'larda calisma
  if (process.env.CLAUDE_AGENT_ID) return;

  // Kisa prompt'larda calisma
  if (input.prompt.length < 15) return;

  // Slash command'larda calisma
  if (input.prompt.trim().startsWith('/')) return;

  // Tum memory'leri tara
  const allHeaders = scanAllMemories();
  if (allHeaders.length === 0) return;

  // Skorla ve sec
  const selected = scoreMemories(allHeaders, input.prompt);
  if (selected.length === 0) return;

  // Iceriklerini oku
  const contents = loadMemoryContents(selected);
  if (!contents) return;

  const context = `## Smart Memory Recall (${selected.length} relevant memories found)

${contents}

---
*Memory recall otomatik. Alakali icerik varsa kullan, yoksa yok say.*`;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    }
  }));
}

main().catch(() => {
  // Silent fail
});
