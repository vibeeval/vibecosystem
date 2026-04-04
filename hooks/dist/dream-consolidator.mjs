// src/dream-consolidator.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CLAUDE_HOME = join(homedir(), ".claude");
var DREAM_DIR = join(CLAUDE_HOME, "dream");
var LOCK_FILE = join(DREAM_DIR, "lock.json");
var MEMORY_DIR = join(CLAUDE_HOME, "projects");
var MIN_HOURS = 24;
var MIN_SESSIONS = 3;
var LOCK_TIMEOUT_MS = 30 * 60 * 1e3;
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function readLock() {
  try {
    if (existsSync(LOCK_FILE)) {
      return JSON.parse(readFileSync(LOCK_FILE, "utf-8"));
    }
  } catch {
  }
  return { lastConsolidatedAt: (/* @__PURE__ */ new Date(0)).toISOString() };
}
function writeLock(data) {
  ensureDir(DREAM_DIR);
  writeFileSync(LOCK_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function isTimeGatePassed(lock) {
  const lastTime = new Date(lock.lastConsolidatedAt).getTime();
  const elapsed = Date.now() - lastTime;
  return elapsed >= MIN_HOURS * 60 * 60 * 1e3;
}
function isLocked(lock) {
  if (!lock.lockedAt) return false;
  const lockTime = new Date(lock.lockedAt).getTime();
  return Date.now() - lockTime < LOCK_TIMEOUT_MS;
}
function countRecentSessions() {
  try {
    if (!existsSync(MEMORY_DIR)) return 0;
    const dirs = readdirSync(MEMORY_DIR);
    let count = 0;
    for (const dir of dirs) {
      const fullPath = join(MEMORY_DIR, dir);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          const age = Date.now() - stat.mtimeMs;
          if (age < 7 * 24 * 60 * 60 * 1e3) {
            count++;
          }
        }
      } catch {
      }
    }
    return count;
  } catch {
    return 0;
  }
}
function findMemoryDirs() {
  const dirs = [];
  try {
    if (!existsSync(MEMORY_DIR)) return dirs;
    for (const proj of readdirSync(MEMORY_DIR)) {
      const memDir = join(MEMORY_DIR, proj, "memory");
      if (existsSync(memDir)) {
        dirs.push(memDir);
      }
    }
  } catch {
  }
  const agentMemDir = join(CLAUDE_HOME, "agent-memory");
  if (existsSync(agentMemDir)) {
    try {
      for (const agent of readdirSync(agentMemDir)) {
        const dir = join(agentMemDir, agent);
        if (existsSync(dir) && statSync(dir).isDirectory()) {
          dirs.push(dir);
        }
      }
    } catch {
    }
  }
  return dirs;
}
function buildConsolidationPrompt(memoryDirs) {
  const dirList = memoryDirs.map((d) => `- \`${d}\``).join("\n");
  return `## Dream: Memory Consolidation

Arka planda memory consolidation tetiklendi. Asagidaki memory dizinlerini gozden gecir ve birlestir.

### Memory Dizinleri

${dirList}

### Adimlar

**Phase 1 - Orient:** Her dizinde ls yap, MEMORY.md'leri oku, mevcut durumu anla.

**Phase 2 - Gather:** Eski, yanlis, veya celisen bilgileri tespit et. Ayrica tekrar eden bilgileri bul.

**Phase 3 - Consolidate:**
- Tekrar eden bilgileri birlestir (duplicate kaldir)
- Eski tarihli bilgileri guncelle veya kaldir
- Celisen bilgilerde GUNCEL olani tut
- Relative tarihleri absolute tarihlere cevir

**Phase 4 - Prune:**
- MEMORY.md index'lerini 200 satir altinda tut
- Artik gecerli olmayan pointer'lari kaldir
- Her entry tek satir, ~150 karakter max

### Kurallar
- Sadece memory dosyalarini duzenle, kod dosyalarina DOKUNMA
- Her Edit oncesi Read yap
- Icerik silmekten korkma - temiz memory > dolu memory
- Bu islem Batuhan'a gorunmez, sessizce yap`;
}
function main() {
  try {
    const input = JSON.parse(process.argv[2] || "{}");
    if (input.event && input.event !== "startup") return;
    const lock = readLock();
    if (!isTimeGatePassed(lock)) return;
    if (isLocked(lock)) return;
    const sessionCount = countRecentSessions();
    if (sessionCount < MIN_SESSIONS) return;
    const memoryDirs = findMemoryDirs();
    if (memoryDirs.length === 0) return;
    writeLock({
      lastConsolidatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lockedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lockedBy: input.session_id || "unknown"
    });
    const prompt = buildConsolidationPrompt(memoryDirs);
    const result = {
      systemMessage: prompt
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
  }
}
main();
