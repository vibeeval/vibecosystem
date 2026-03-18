/**
 * Context Budget Manager
 * Hook'larin context window'a ne kadar veri enjekte edebilecegini kontrol eder.
 * Her event batch icin MAX_PER_EVENT_CHARS, session genelinde MAX_SESSION_CHARS limiti var.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const MAX_PER_EVENT_CHARS = 8000;   // ~2K token per event batch
const MAX_SESSION_CHARS = 50000;    // ~12K token per session total

const BUDGET_PATH = join(homedir(), '.claude', 'cache', 'context-budget.json');

interface BudgetState {
  session_id: string;
  total_chars: number;
  per_hook: Record<string, number>;
  per_event: Record<string, number>;
  updated_at: string;
}

function loadBudget(): BudgetState {
  try {
    if (existsSync(BUDGET_PATH)) {
      return JSON.parse(readFileSync(BUDGET_PATH, 'utf-8'));
    }
  } catch { /* fresh start */ }
  return {
    session_id: 'unknown',
    total_chars: 0,
    per_hook: {},
    per_event: {},
    updated_at: new Date().toISOString(),
  };
}

function saveBudget(budget: BudgetState): void {
  try {
    const cacheDir = join(homedir(), '.claude', 'cache');
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(BUDGET_PATH, JSON.stringify(budget, null, 2));
  } catch { /* skip */ }
}

/**
 * Belirtilen hook'un bu event icin enjeksiyon yapip yapamayacagini kontrol eder.
 */
export function canInject(hookName: string, eventKey: string, charCount: number): boolean {
  const budget = loadBudget();
  if (budget.total_chars + charCount > MAX_SESSION_CHARS) return false;
  const eventChars = budget.per_event[eventKey] || 0;
  if (eventChars + charCount > MAX_PER_EVENT_CHARS) return false;
  return true;
}

/**
 * Yapilan enjeksiyonu kaydet.
 */
export function recordInjection(hookName: string, eventKey: string, charCount: number): void {
  const budget = loadBudget();
  budget.total_chars += charCount;
  budget.per_hook[hookName] = (budget.per_hook[hookName] || 0) + charCount;
  budget.per_event[eventKey] = (budget.per_event[eventKey] || 0) + charCount;
  budget.updated_at = new Date().toISOString();
  saveBudget(budget);
}

/**
 * Atomik canInject + recordInjection: kontrol ve kaydi tek seferde yapar.
 * Race condition penceresi daraltilmis versiyon.
 */
export function tryInject(hookName: string, eventKey: string, charCount: number): boolean {
  const budget = loadBudget();
  if (budget.total_chars + charCount > MAX_SESSION_CHARS) return false;
  const eventChars = budget.per_event[eventKey] || 0;
  if (eventChars + charCount > MAX_PER_EVENT_CHARS) return false;

  budget.total_chars += charCount;
  budget.per_hook[hookName] = (budget.per_hook[hookName] || 0) + charCount;
  budget.per_event[eventKey] = (budget.per_event[eventKey] || 0) + charCount;
  budget.updated_at = new Date().toISOString();
  saveBudget(budget);
  return true;
}

/**
 * Session baslangicinda budget'i sifirla.
 */
export function resetBudget(sessionId: string): void {
  const budget: BudgetState = {
    session_id: sessionId,
    total_chars: 0,
    per_hook: {},
    per_event: {},
    updated_at: new Date().toISOString(),
  };
  saveBudget(budget);
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
    const taskType = intent.task_type || 'conversational';

    return relevantTypes.includes(taskType);
  } catch {
    return true; // Hata durumunda guvenli taraf
  }
}
