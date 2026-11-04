// src/dream-consolidator.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync2, existsSync as existsSync2, mkdirSync as mkdirSync2, readdirSync, statSync as statSync2 } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";

// src/shared/hook-input.ts
import { readFileSync as readFileSync2 } from "node:fs";

// src/shared/context-budget.ts
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
  renameSync,
  rmSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
var DEFAULT_LIMITS = { perEventChars: 4e3, sessionChars: 12e3 };
var TRUNCATION_MARKER = "\n[truncated]";
var MAX_EVENT_RECORDS = 256;
var MAX_DEDUP_RECORDS = 256;
var scope = { sessionId: "", project: process.cwd(), eventId: "" };
var localBudget;
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
function configureContextBudget(input) {
  const sessionId = typeof input.session_id === "string" ? input.session_id : "";
  const project = typeof input.cwd === "string" ? resolve(input.cwd) : process.cwd();
  const eventId = typeof input.tool_use_id === "string" ? input.tool_use_id : digest(JSON.stringify(input));
  if (scope.sessionId !== sessionId || scope.project !== project) localBudget = void 0;
  scope = { sessionId, project, eventId };
}
function budgetPath() {
  if (!scope.sessionId) return void 0;
  const base = process.env.VIBECO_CONTEXT_BUDGET_PATH || join(homedir(), ".claude", "cache", "context-budget.json");
  const directory = join(dirname(base), `${basename(base, ".json")}.sessions`);
  return join(directory, `${digest(`${scope.project}\0${scope.sessionId}`)}.json`);
}
function runtimePath() {
  return process.env.VIBECO_RUNTIME_PATH || join(homedir(), ".claude", "vibecosystem-runtime.json");
}
function getBudgetLimits() {
  try {
    const runtime = JSON.parse(readFileSync(runtimePath(), "utf8"));
    const perEventChars = runtime.contextBudget?.perEventChars;
    const sessionChars = runtime.contextBudget?.sessionChars;
    if (typeof perEventChars === "number" && Number.isFinite(perEventChars) && typeof sessionChars === "number" && Number.isFinite(sessionChars)) {
      return {
        perEventChars: Math.max(0, Math.floor(perEventChars)),
        sessionChars: Math.max(0, Math.floor(sessionChars))
      };
    }
  } catch {
  }
  return DEFAULT_LIMITS;
}
function freshBudget() {
  return {
    session_id: scope.sessionId,
    total_chars: 0,
    per_hook: {},
    per_event: {},
    seen: {},
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function validCounters(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0);
}
function loadBudget(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value.session_id === scope.sessionId && Number.isFinite(value.total_chars) && value.total_chars >= 0 && validCounters(value.per_hook) && validCounters(value.per_event) && value.seen && typeof value.seen === "object" && !Array.isArray(value.seen)) return value;
  } catch {
  }
  return freshBudget();
}
function withBudget(action, fallback) {
  const path = budgetPath();
  if (!path) {
    localBudget ||= freshBudget();
    return action(localBudget);
  }
  const lock = `${path}.lock`;
  let locked = false;
  let temporary;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 448 });
    const deadline = Date.now() + 200;
    while (!locked) {
      try {
        mkdirSync(lock, { mode: 448 });
        locked = true;
      } catch (error) {
        if (error.code !== "EEXIST") return fallback;
        try {
          if (Date.now() - statSync(lock).mtimeMs > 6e4) rmSync(lock, { recursive: true });
        } catch {
        }
        if (Date.now() >= deadline) return fallback;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    }
    const budget = loadBudget(path);
    const previous = JSON.stringify(budget);
    const result = action(budget);
    if (JSON.stringify(budget) === previous) return result;
    budget.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(temporary, JSON.stringify(budget), { mode: 384 });
    renameSync(temporary, path);
    return result;
  } catch {
    return fallback;
  } finally {
    if (temporary) {
      try {
        rmSync(temporary, { force: true });
      } catch {
      }
    }
    if (locked) {
      try {
        rmSync(lock, { recursive: true });
      } catch {
      }
    }
  }
}
function eventIdentity(eventKey) {
  return digest(scope.eventId || eventKey);
}
function remaining(budget, limits, event) {
  return Math.max(0, Math.min(
    limits.sessionChars - budget.total_chars,
    limits.perEventChars - (budget.per_event[event] || 0)
  ));
}
function boundedMap(values, maximum) {
  while (Object.keys(values).length > maximum) delete values[Object.keys(values)[0]];
}
function reserve(budget, hookName, event, charCount) {
  budget.total_chars += charCount;
  const hook = digest(hookName);
  budget.per_hook[hook] = (budget.per_hook[hook] || 0) + charCount;
  budget.per_event[event] = (budget.per_event[event] || 0) + charCount;
  boundedMap(budget.per_event, MAX_EVENT_RECORDS);
}
function truncate(context, available) {
  if (context.length <= available) return context;
  const marker = available > TRUNCATION_MARKER.length ? TRUNCATION_MARKER : "";
  let end = available - marker.length;
  if (end > 0 && /[\uD800-\uDBFF]/.test(context[end - 1]) && /[\uDC00-\uDFFF]/.test(context[end] || "")) end--;
  return context.slice(0, end) + marker;
}
function budgetContext(hookName, eventKey, context, options = {}) {
  if (!context) return "";
  return withBudget((budget) => {
    const event = eventIdentity(eventKey);
    const dedup = options.deduplicate === false ? "" : digest(
      `${hookName}\0${options.deduplicate === "session" ? eventKey : event}\0${context}`
    );
    if (dedup && budget.seen[dedup]) return "";
    const available = remaining(budget, getBudgetLimits(), event);
    if (!available) return "";
    const bounded = truncate(context, available);
    if (!bounded) return "";
    reserve(budget, hookName, event, bounded.length);
    if (dedup) {
      budget.seen[dedup] = true;
      boundedMap(budget.seen, MAX_DEDUP_RECORDS);
    }
    return bounded;
  }, "");
}
function budgetHookOutput(output, hookName, eventKey, options = {}) {
  const root = output;
  function boundField(object, field, key) {
    if (typeof object[field] !== "string") return;
    const context = budgetContext(hookName, key, object[field], options);
    if (context) object[field] = context;
    else delete object[field];
  }
  boundField(root, "additionalContext", eventKey);
  const hookOutput = root.hookSpecificOutput;
  if (hookOutput && typeof hookOutput === "object") {
    boundField(hookOutput, "additionalContext", eventKey);
    if (Object.keys(hookOutput).length === 0) delete root.hookSpecificOutput;
  }
  for (const field of ["message", "systemMessage"]) boundField(root, field, `${eventKey}:${field}`);
  return output;
}

// src/shared/hook-input.ts
function readHookInput(raw = readFileSync2(0, "utf-8")) {
  const input = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Hook input must be a JSON object");
  }
  configureContextBudget(input);
  return input;
}

// src/dream-consolidator.ts
var CLAUDE_HOME = join2(homedir2(), ".claude");
var DREAM_DIR = join2(CLAUDE_HOME, "dream");
var LOCK_FILE = join2(DREAM_DIR, "lock.json");
var MEMORY_DIR = join2(CLAUDE_HOME, "projects");
var MIN_HOURS = 24;
var MIN_SESSIONS = 3;
var LOCK_TIMEOUT_MS = 30 * 60 * 1e3;
function ensureDir(dir) {
  if (!existsSync2(dir)) {
    mkdirSync2(dir, { recursive: true });
  }
}
function readLock() {
  try {
    if (existsSync2(LOCK_FILE)) {
      return JSON.parse(readFileSync3(LOCK_FILE, "utf-8"));
    }
  } catch {
  }
  return { lastConsolidatedAt: (/* @__PURE__ */ new Date(0)).toISOString() };
}
function writeLock(data) {
  ensureDir(DREAM_DIR);
  writeFileSync2(LOCK_FILE, JSON.stringify(data, null, 2), "utf-8");
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
    if (!existsSync2(MEMORY_DIR)) return 0;
    const dirs = readdirSync(MEMORY_DIR);
    let count = 0;
    for (const dir of dirs) {
      const fullPath = join2(MEMORY_DIR, dir);
      try {
        const stat = statSync2(fullPath);
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
    if (!existsSync2(MEMORY_DIR)) return dirs;
    for (const proj of readdirSync(MEMORY_DIR)) {
      const memDir = join2(MEMORY_DIR, proj, "memory");
      if (existsSync2(memDir)) {
        dirs.push(memDir);
      }
    }
  } catch {
  }
  const agentMemDir = join2(CLAUDE_HOME, "agent-memory");
  if (existsSync2(agentMemDir)) {
    try {
      for (const agent of readdirSync(agentMemDir)) {
        const dir = join2(agentMemDir, agent);
        if (existsSync2(dir) && statSync2(dir).isDirectory()) {
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
- Bu islem kullaniciya gorunmez, sessizce yap`;
}
function main() {
  try {
    const input = readHookInput();
    if (input.source !== "startup") return;
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
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: prompt }
    };
    process.stdout.write(JSON.stringify(budgetHookOutput(result, "dream-consolidator", "SessionStart")));
  } catch {
  }
}
main();
