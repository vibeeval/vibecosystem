/**
 * Shared database utilities for Claude Code hooks.
 *
 * Phase 2: Migrated from Python subprocess to better-sqlite3 for
 * ~97% latency improvement (150-400ms → <5ms).
 *
 * Exports:
 * - getDbPath(): Returns path to coordination.db
 * - queryDb(): @deprecated - Executes Python subprocess to query SQLite
 * - runPythonQuery(): @deprecated - Returns success/stdout/stderr object
 * - registerAgent(): Register agent in coordination DB (native)
 * - completeAgent(): Mark agent completed (native)
 * - detectAndTagSwarm(): Auto-detect swarm patterns (native)
 * - getActiveAgentCount(): Count running agents (native)
 */

import { spawnSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { QueryResult } from './types.js';

// Re-export SAFE_ID_PATTERN and isValidId from pattern-router for convenience
export { SAFE_ID_PATTERN, isValidId } from './pattern-router.js';

// =============================================================================
// Lazy singleton DB connection
// =============================================================================

let _db: DatabaseType | null = null;

function getDb(): DatabaseType {
  if (_db) return _db;
  const dbPath = getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('busy_timeout = 5000');
  _db.pragma('journal_mode = WAL');
  return _db;
}

// Defensive cleanup on process exit
process.on('exit', () => { try { _db?.close(); } catch { /* ignore */ } });

function ensureAgentsTable(db: DatabaseType): void {
  db.exec(`CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    premise TEXT,
    model TEXT,
    scope_keys TEXT,
    pattern TEXT,
    parent_agent_id TEXT,
    pid INTEGER,
    ppid INTEGER,
    spawned_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT DEFAULT 'running',
    error_message TEXT,
    source TEXT
  )`);
  const cols = (db.pragma('table_info(agents)') as Array<{ name: string }>).map(c => c.name);
  if (!cols.includes('source')) db.exec('ALTER TABLE agents ADD COLUMN source TEXT');
}

// =============================================================================
// Core path utility
// =============================================================================

/**
 * Get the path to the coordination database.
 *
 * Uses CLAUDE_PROJECT_DIR environment variable if set,
 * otherwise falls back to process.cwd().
 */
export function getDbPath(): string {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return join(projectDir, '.claude', 'cache',
    'agentica-coordination', 'coordination.db');
}

// =============================================================================
// Legacy Python bridge (deprecated - kept for pattern files)
// =============================================================================

/**
 * @deprecated Use native better-sqlite3 functions instead.
 * Kept for backward compatibility with pattern files (src/patterns/*.ts).
 */
export function queryDb(pythonQuery: string, args: string[]): string {
  const result = spawnSync('python3', ['-c', pythonQuery, ...args], {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024
  });

  if (result.status !== 0) {
    const errorMsg = result.stderr || `Python exited with code ${result.status}`;
    throw new Error(`Python query failed: ${errorMsg}`);
  }

  return result.stdout.trim();
}

/**
 * @deprecated Use native better-sqlite3 functions instead.
 * Kept for backward compatibility with pattern files (src/patterns/*.ts).
 */
export function runPythonQuery(script: string, args: string[]): QueryResult {
  try {
    const result = spawnSync('python3', ['-c', script, ...args], {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024
    });

    return {
      success: result.status === 0,
      stdout: result.stdout?.trim() || '',
      stderr: result.stderr || ''
    };
  } catch (err) {
    return {
      success: false,
      stdout: '',
      stderr: String(err)
    };
  }
}

// =============================================================================
// Native better-sqlite3 implementations
// =============================================================================

/**
 * Register a new agent in the coordination database.
 *
 * Inserts a new agent record with status='running'.
 * Creates the database and tables if they don't exist.
 * Automatically detects source from environment (AGENTICA_SERVER env var).
 */
export function registerAgent(
  agentId: string,
  sessionId: string,
  pattern: string | null = null,
  pid: number | null = null
): { success: boolean; error?: string } {
  try {
    const source = process.env.AGENTICA_SERVER ? 'agentica' : 'cli';
    const db = getDb();
    ensureAgentsTable(db);

    const now = new Date().toISOString().replace('Z', '');
    const ppid = pid ? process.ppid : null;

    db.prepare(`
      INSERT OR REPLACE INTO agents
      (id, session_id, pattern, pid, ppid, spawned_at, status, source)
      VALUES (?, ?, ?, ?, ?, ?, 'running', ?)
    `).run(agentId, sessionId, pattern, pid, ppid, now, source);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Mark an agent as completed in the coordination database.
 *
 * Updates the agent's status and sets completed_at timestamp.
 */
export function completeAgent(
  agentId: string,
  status: string = 'completed',
  errorMessage: string | null = null
): { success: boolean; error?: string } {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return { success: true };

  try {
    const db = getDb();

    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agents'"
    ).get();
    if (!tableExists) return { success: true };

    const now = new Date().toISOString().replace('Z', '');
    db.prepare(`
      UPDATE agents
      SET completed_at = ?, status = ?, error_message = ?
      WHERE id = ?
    `).run(now, status, errorMessage, agentId);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Detect if this agent is part of a swarm (concurrent spawn pattern).
 *
 * Checks if there are multiple agents in the same session spawned within
 * a short time window (5 seconds). If so, updates all of them to pattern="swarm".
 */
export function detectAndTagSwarm(sessionId: string): boolean {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return false;

  try {
    const db = getDb();

    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agents'"
    ).get();
    if (!tableExists) return false;

    const cutoff = new Date(Date.now() - 5000).toISOString().replace('Z', '');

    const rows = db.prepare(`
      SELECT id FROM agents
      WHERE session_id = ?
        AND spawned_at > ?
        AND status = 'running'
        AND (pattern = 'task' OR pattern IS NULL)
    `).all(sessionId, cutoff) as Array<{ id: string }>;

    if (rows.length > 1) {
      const ids = rows.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(
        `UPDATE agents SET pattern = 'swarm' WHERE id IN (${placeholders})`
      ).run(...ids);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get the count of active (running) agents across all sessions.
 *
 * Returns 0 if database doesn't exist, query fails, or agents table doesn't exist.
 */
export function getActiveAgentCount(): number {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return 0;

  try {
    const db = getDb();

    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agents'"
    ).get();
    if (!tableExists) return 0;

    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM agents WHERE status = 'running'"
    ).get() as { cnt: number } | undefined;

    return row?.cnt ?? 0;
  } catch {
    return 0;
  }
}
