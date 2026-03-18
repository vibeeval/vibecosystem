/**
 * GitHub Bridge - Issue ve PR islemleri icin `gh` CLI wrapper
 * Rate limiting: session basina max 3 issue
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const RATE_LIMIT_PATH = join(homedir(), '.claude', 'cache', 'github-rate-limit.json');
const MAX_ISSUES_PER_SESSION = 3;

interface RateLimitState {
  session_id: string;
  issues_created: number;
  updated_at: string;
}

function loadRateLimit(): RateLimitState {
  try {
    if (existsSync(RATE_LIMIT_PATH)) {
      return JSON.parse(readFileSync(RATE_LIMIT_PATH, 'utf-8'));
    }
  } catch { /* fresh */ }
  return { session_id: 'unknown', issues_created: 0, updated_at: new Date().toISOString() };
}

function saveRateLimit(state: RateLimitState): void {
  try {
    const cacheDir = join(homedir(), '.claude', 'cache');
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(RATE_LIMIT_PATH, JSON.stringify(state, null, 2));
  } catch { /* skip */ }
}

/**
 * Mevcut git repo'sunu tespit eder.
 * @returns "owner/repo" formati veya null
 */
export function getCurrentRepo(): string | null {
  try {
    const result = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * GitHub issue olusturur. Rate limiting uygulanir.
 * @returns Issue URL veya null (rate limit veya hata durumunda)
 */
export function createIssue(title: string, body: string, labels?: string[]): string | null {
  const state = loadRateLimit();
  if (state.issues_created >= MAX_ISSUES_PER_SESSION) {
    return null; // Rate limit
  }

  try {
    const args = ['issue', 'create', '--title', title.slice(0, 256), '--body', body.slice(0, 4000)];
    if (labels && labels.length > 0) {
      args.push('--label', labels.join(','));
    }

    const result = execFileSync('gh', args, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    state.issues_created++;
    state.updated_at = new Date().toISOString();
    saveRateLimit(state);

    return result || null;
  } catch {
    return null;
  }
}

/**
 * PR'a yorum ekler.
 */
export function addPRComment(prNumber: number, body: string): boolean {
  if (!Number.isInteger(prNumber) || prNumber < 1) return false;
  try {
    execFileSync('gh', ['pr', 'comment', String(prNumber), '--body', body.slice(0, 4000)], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Session rate limit'i sifirlar (session basinda cagirilir).
 */
export function resetGitHubRateLimit(sessionId: string): void {
  saveRateLimit({ session_id: sessionId, issues_created: 0, updated_at: new Date().toISOString() });
}
