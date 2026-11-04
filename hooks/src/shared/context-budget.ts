/** Bounded advisory context, scoped to the Claude session and project. */
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, statSync,
  renameSync, rmSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const DEFAULT_LIMITS = { perEventChars: 4000, sessionChars: 12000 };
const FULL_LIMITS = { perEventChars: 8000, sessionChars: 50000 };
const TRUNCATION_MARKER = '\n[truncated]';
const MAX_EVENT_RECORDS = 256;
const MAX_DEDUP_RECORDS = 256;

interface BudgetLimits { perEventChars: number; sessionChars: number }
interface BudgetState {
  session_id: string;
  total_chars: number;
  per_hook: Record<string, number>;
  per_event: Record<string, number>;
  seen: Record<string, true>;
  updated_at: string;
}
interface BudgetScope { sessionId: string; project: string; eventId: string }
export interface BudgetOptions { deduplicate?: 'event' | 'session' | false }

// No disk-backed fallback to a global session: payloads without a session ID
// receive process-local limits and cannot poison another Claude session.
let scope: BudgetScope = { sessionId: '', project: process.cwd(), eventId: '' };
let localBudget: BudgetState | undefined;
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Called by the shared stdin reader before a hook assembles its output. */
export function configureContextBudget(input: Record<string, unknown>): void {
  const sessionId = typeof input.session_id === 'string' ? input.session_id : '';
  const project = typeof input.cwd === 'string' ? resolve(input.cwd) : process.cwd();
  // tool_use_id identifies a tool invocation across parallel hook processes.
  // Other events use the payload fingerprint; identical payloads share a cap.
  const eventId = typeof input.tool_use_id === 'string'
    ? input.tool_use_id : digest(JSON.stringify(input));
  if (scope.sessionId !== sessionId || scope.project !== project) localBudget = undefined;
  scope = { sessionId, project, eventId };
}

function budgetPath(): string | undefined {
  if (!scope.sessionId) return undefined;
  const base = process.env.VIBECO_CONTEXT_BUDGET_PATH
    || join(homedir(), '.claude', 'cache', 'context-budget.json');
  const directory = join(dirname(base), `${basename(base, '.json')}.sessions`);
  return join(directory, `${digest(`${scope.project}\0${scope.sessionId}`)}.json`);
}
function runtimePath(): string {
  return process.env.VIBECO_RUNTIME_PATH
    || join(homedir(), '.claude', 'vibecosystem-runtime.json');
}
function getBudgetLimits(): BudgetLimits {
  try {
    const runtime = JSON.parse(readFileSync(runtimePath(), 'utf8'));
    const perEventChars = runtime.contextBudget?.perEventChars;
    const sessionChars = runtime.contextBudget?.sessionChars;
    if (typeof perEventChars === 'number' && Number.isFinite(perEventChars)
      && typeof sessionChars === 'number' && Number.isFinite(sessionChars)) {
      return { perEventChars: Math.max(0, Math.floor(perEventChars)),
        sessionChars: Math.max(0, Math.floor(sessionChars)) };
    }
  } catch { /* use core defaults */ }
  return DEFAULT_LIMITS;
}
function freshBudget(): BudgetState {
  return { session_id: scope.sessionId, total_chars: 0, per_hook: {},
    per_event: {}, seen: {}, updated_at: new Date().toISOString() };
}
function validCounters(value: unknown): value is Record<string, number> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
}
function loadBudget(path: string): BudgetState {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (value.session_id === scope.sessionId && Number.isFinite(value.total_chars)
      && value.total_chars >= 0 && validCounters(value.per_hook) && validCounters(value.per_event)
      && value.seen && typeof value.seen === 'object' && !Array.isArray(value.seen)) return value;
  } catch { /* missing or damaged cache */ }
  return freshBudget();
}

/** Serialize reservations across hook processes; never inject unaccounted output. */
function withBudget<T>(action: (budget: BudgetState) => T, fallback: T): T {
  const path = budgetPath();
  if (!path) {
    localBudget ||= freshBudget();
    return action(localBudget);
  }
  const lock = `${path}.lock`;
  let locked = false;
  let temporary: string | undefined;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const deadline = Date.now() + 200;
    while (!locked) {
      try { mkdirSync(lock, { mode: 0o700 }); locked = true; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return fallback;
        // Recover a cache lock left by a killed hook, never a current operation.
        try { if (Date.now() - statSync(lock).mtimeMs > 60_000) rmSync(lock, { recursive: true }); }
        catch { /* another hook released it */ }
        if (Date.now() >= deadline) return fallback;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    }
    const budget = loadBudget(path);
    const previous = JSON.stringify(budget);
    const result = action(budget);
    // Suppressed duplicates and read-only checks do not rewrite the cache.
    if (JSON.stringify(budget) === previous) return result;
    budget.updated_at = new Date().toISOString();
    temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(temporary, JSON.stringify(budget), { mode: 0o600 });
    renameSync(temporary, path);
    return result;
  } catch { return fallback; }
  finally {
    if (temporary) { try { rmSync(temporary, { force: true }); } catch { /* cache only */ } }
    if (locked) { try { rmSync(lock, { recursive: true }); } catch { /* stale recovery handles it */ } }
  }
}
function eventIdentity(eventKey: string): string {
  return digest(scope.eventId || eventKey);
}
function remaining(budget: BudgetState, limits: BudgetLimits, event: string): number {
  return Math.max(0, Math.min(limits.sessionChars - budget.total_chars,
    limits.perEventChars - (budget.per_event[event] || 0)));
}
function boundedMap<T>(values: Record<string, T>, maximum: number): void {
  while (Object.keys(values).length > maximum) delete values[Object.keys(values)[0]];
}
function reserve(budget: BudgetState, hookName: string, event: string, charCount: number): void {
  budget.total_chars += charCount;
  const hook = digest(hookName);
  budget.per_hook[hook] = (budget.per_hook[hook] || 0) + charCount;
  budget.per_event[event] = (budget.per_event[event] || 0) + charCount;
  boundedMap(budget.per_event, MAX_EVENT_RECORDS);
}
function validCount(count: number): boolean {
  return Number.isSafeInteger(count) && count >= 0;
}
/** Read-only availability is advisory; use tryInject to reserve atomically. */
export function canInject(_hookName: string, eventKey: string, charCount: number): boolean {
  if (!validCount(charCount)) return false;
  return withBudget(budget => remaining(budget, getBudgetLimits(), eventIdentity(eventKey)) >= charCount, false);
}
/** Compatibility wrapper; all reservations now enforce both limits. */
export function recordInjection(hookName: string, eventKey: string, charCount: number): void {
  tryInject(hookName, eventKey, charCount);
}
export function tryInject(hookName: string, eventKey: string, charCount: number): boolean {
  if (!validCount(charCount)) return false;
  return withBudget(budget => {
    const event = eventIdentity(eventKey);
    if (remaining(budget, getBudgetLimits(), event) < charCount) return false;
    reserve(budget, hookName, event, charCount);
    return true;
  }, false);
}
function truncate(context: string, available: number): string {
  if (context.length <= available) return context;
  // Small caps carry useful text rather than a marker that exceeds the cap.
  const marker = available > TRUNCATION_MARKER.length ? TRUNCATION_MARKER : '';
  let end = available - marker.length;
  // Character budgets use UTF-16 code units, matching String.length; never emit
  // half a surrogate pair when the boundary falls inside an emoji.
  if (end > 0 && /[\uD800-\uDBFF]/.test(context[end - 1])
    && /[\uDC00-\uDFFF]/.test(context[end] || '')) end--;
  return context.slice(0, end) + marker;
}
export function budgetContext(
  hookName: string, eventKey: string, context: string, options: BudgetOptions = {},
): string {
  if (!context) return '';
  return withBudget(budget => {
    const event = eventIdentity(eventKey);
    const dedup = options.deduplicate === false ? '' : digest(
      `${hookName}\0${options.deduplicate === 'session' ? eventKey : event}\0${context}`,
    );
    if (dedup && budget.seen[dedup]) return '';
    const available = remaining(budget, getBudgetLimits(), event);
    if (!available) return '';
    const bounded = truncate(context, available);
    if (!bounded) return '';
    reserve(budget, hookName, event, bounded.length);
    if (dedup) { budget.seen[dedup] = true; boundedMap(budget.seen, MAX_DEDUP_RECORDS); }
    return bounded;
  }, '');
}

/** Budget advisory text only; preserve permission decisions and modified tool input. */
export function budgetHookOutput<T extends Record<string, any>>(
  output: T, hookName: string, eventKey: string, options: BudgetOptions = {},
): T {
  const root = output as Record<string, any>;
  function boundField(object: Record<string, any>, field: string, key: string): void {
    if (typeof object[field] !== 'string') return;
    const context = budgetContext(hookName, key, object[field], options);
    if (context) object[field] = context;
    else delete object[field];
  }
  boundField(root, 'additionalContext', eventKey);
  const hookOutput = root.hookSpecificOutput;
  if (hookOutput && typeof hookOutput === 'object') {
    boundField(hookOutput, 'additionalContext', eventKey);
    if (Object.keys(hookOutput).length === 0) delete root.hookSpecificOutput;
  }
  for (const field of ['message', 'systemMessage']) boundField(root, field, `${eventKey}:${field}`);
  return output;
}
export { DEFAULT_LIMITS, FULL_LIMITS, getBudgetLimits };

/** Explicit reset is optional: unseen payload session IDs start with a fresh budget. */
export function resetBudget(sessionId: string): void {
  scope = { ...scope, sessionId, eventId: '' };
  localBudget = undefined;
  withBudget(budget => { Object.assign(budget, freshBudget()); return true; }, false);
}

/**
 * Hook'un mevcut intent icin relevant olup olmadigini kontrol eder.
 * current-intent.json'dan intent tipini okur.
 */
const HOOK_RELEVANCE: Record<string, string[]> = {
  'tldr-read-enforcer': ['implementation', 'debug', 'research'],
  'smart-search-router': ['implementation', 'debug', 'research'],
  'signature-helper': ['implementation'],
  'arch-context-inject': ['implementation', 'planning'],
  'compiler-in-the-loop': ['implementation', 'debug'],
  'edit-context-inject': ['implementation'],
  'impact-refactor': ['implementation'],
};

/**
 * Hook'un mevcut intent icin relevant olup olmadigini kontrol eder.
 * Intent bilinmiyorsa veya hook listede yoksa true doner (guvenli taraf).
 */
export function isRelevantForIntent(hookName: string): boolean {
  const relevantTypes = HOOK_RELEVANCE[hookName];
  if (!relevantTypes) return true; // Listede yoksa her zaman calistir

  try {
    const intentPath = join(homedir(), '.claude', 'cache', 'current-intent.json');
    if (!existsSync(intentPath)) return true; // Intent bilinmiyorsa calistir

    // Staleness kontrolu: 30dk'dan eski intent dosyasini yoksay (farkli session'dan kalmis olabilir)
    const fileStat = statSync(intentPath);
    const ageMs = Date.now() - fileStat.mtimeMs;
    if (ageMs > 30 * 60 * 1000) return true;

    const intent = JSON.parse(readFileSync(intentPath, 'utf-8'));
    // The legacy intent cache is global and stores an eight-character ID.
    // A different session's classification must never suppress this hook.
    if (!scope.sessionId || (intent.session_id !== scope.sessionId
      && intent.session_id !== scope.sessionId.slice(0, 8))) return true;
    const taskType = intent.task_type || 'conversational';

    return relevantTypes.includes(taskType);
  } catch {
    return true; // Hata durumunda guvenli taraf
  }
}
