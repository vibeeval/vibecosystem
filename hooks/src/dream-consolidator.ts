/**
 * Dream Consolidator - SessionStart hook
 *
 * Session basladiginda memory consolidation gerekip gerekmedegini kontrol eder.
 * Kosullar saglanirsa (zaman + session esigi) consolidation prompt'unu inject eder.
 *
 * Claude Code kaynak kodundan (autoDream.ts) ilham alinmistir.
 *
 * Gate order (ucuzdan pahaliya):
 *   1. Zaman: son consolidation'dan beri >= minHours saat gecmis mi?
 *   2. Session: gecen suredir >= minSessions session olmus mu?
 *   3. Lock: baska process consolidation yapiyor mu?
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_HOME = join(homedir(), '.claude');
const DREAM_DIR = join(CLAUDE_HOME, 'dream');
const LOCK_FILE = join(DREAM_DIR, 'lock.json');
const MEMORY_DIR = join(CLAUDE_HOME, 'projects');

// Config
const MIN_HOURS = 24;         // En az 24 saat gecmeli
const MIN_SESSIONS = 3;       // En az 3 session olmus olmali
const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika lock timeout

interface LockData {
  lastConsolidatedAt: string;
  lockedAt?: string;
  lockedBy?: string;
}

interface SessionStartInput {
  session_id?: string;
  event?: string;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readLock(): LockData {
  try {
    if (existsSync(LOCK_FILE)) {
      return JSON.parse(readFileSync(LOCK_FILE, 'utf-8'));
    }
  } catch {
    // corrupt
  }
  return { lastConsolidatedAt: new Date(0).toISOString() };
}

function writeLock(data: LockData): void {
  ensureDir(DREAM_DIR);
  writeFileSync(LOCK_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Son consolidation'dan beri yeterli zaman gecti mi?
 */
function isTimeGatePassed(lock: LockData): boolean {
  const lastTime = new Date(lock.lastConsolidatedAt).getTime();
  const elapsed = Date.now() - lastTime;
  return elapsed >= MIN_HOURS * 60 * 60 * 1000;
}

/**
 * Lock aktif mi? (baska process consolidation yapiyor mu?)
 */
function isLocked(lock: LockData): boolean {
  if (!lock.lockedAt) return false;
  const lockTime = new Date(lock.lockedAt).getTime();
  // Lock timeout'u gecmisse lock'u kirdi say
  return (Date.now() - lockTime) < LOCK_TIMEOUT_MS;
}

/**
 * Memory dizinindeki proje sayisini say
 * (her proje dizini bir "session" olarak sayilir)
 */
function countRecentSessions(): number {
  try {
    if (!existsSync(MEMORY_DIR)) return 0;
    const dirs = readdirSync(MEMORY_DIR);
    // Her proje dizinini say
    let count = 0;
    for (const dir of dirs) {
      const fullPath = join(MEMORY_DIR, dir);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          // Son 7 gunde degistirilmis mi?
          const age = Date.now() - stat.mtimeMs;
          if (age < 7 * 24 * 60 * 60 * 1000) {
            count++;
          }
        }
      } catch {
        // skip
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Memory dizinlerini listele
 */
function findMemoryDirs(): string[] {
  const dirs: string[] = [];
  try {
    if (!existsSync(MEMORY_DIR)) return dirs;
    for (const proj of readdirSync(MEMORY_DIR)) {
      const memDir = join(MEMORY_DIR, proj, 'memory');
      if (existsSync(memDir)) {
        dirs.push(memDir);
      }
    }
  } catch {
    // ignore
  }

  // Agent memory de ekle
  const agentMemDir = join(CLAUDE_HOME, 'agent-memory');
  if (existsSync(agentMemDir)) {
    try {
      for (const agent of readdirSync(agentMemDir)) {
        const dir = join(agentMemDir, agent);
        if (existsSync(dir) && statSync(dir).isDirectory()) {
          dirs.push(dir);
        }
      }
    } catch {
      // ignore
    }
  }

  return dirs;
}

function buildConsolidationPrompt(memoryDirs: string[]): string {
  const dirList = memoryDirs.map(d => `- \`${d}\``).join('\n');

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
- Bu islem kullaniciya gorunmez, sessizce yap`;
}

function main() {
  try {
    const input: SessionStartInput = JSON.parse(process.argv[2] || '{}');

    // Sadece startup event'inde calis (resume/compact'ta calisma)
    if (input.event && input.event !== 'startup') return;

    const lock = readLock();

    // Gate 1: Zaman kontrolu
    if (!isTimeGatePassed(lock)) return;

    // Gate 2: Lock kontrolu
    if (isLocked(lock)) return;

    // Gate 3: Session sayisi kontrolu
    const sessionCount = countRecentSessions();
    if (sessionCount < MIN_SESSIONS) return;

    // Memory dizinlerini bul
    const memoryDirs = findMemoryDirs();
    if (memoryDirs.length === 0) return;

    // Lock'u al
    writeLock({
      lastConsolidatedAt: new Date().toISOString(),
      lockedAt: new Date().toISOString(),
      lockedBy: input.session_id || 'unknown',
    });

    // Consolidation prompt'unu inject et
    const prompt = buildConsolidationPrompt(memoryDirs);

    const result = {
      systemMessage: prompt,
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
    // sessiz
  }
}

main();
