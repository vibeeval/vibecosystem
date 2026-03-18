/**
 * Native SQLite database utility for pattern files.
 *
 * Replaces Python subprocess calls (runPythonQuery) with native better-sqlite3.
 * Provides connection pooling per DB path with WAL mode and busy_timeout.
 *
 * Usage:
 *   import { getPatternDb } from '../shared/native-db.js';
 *   const db = getPatternDb(dbPath);
 *   db.exec(`CREATE TABLE IF NOT EXISTS ...`);
 *   db.prepare('SELECT ...').all(param1, param2);
 */
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export type { DatabaseType as NativeDatabase };

const _connections = new Map<string, DatabaseType>();

/**
 * Get or create a database connection for the given path.
 * Connections are cached per path and reused within the same process.
 * WAL mode and busy_timeout are set automatically.
 */
export function getPatternDb(dbPath: string): DatabaseType {
  let db = _connections.get(dbPath);
  if (db) return db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  _connections.set(dbPath, db);
  return db;
}

/**
 * Close and remove a cached connection for the given path.
 * Useful in tests where the DB file is recreated between runs.
 */
export function closePatternDb(dbPath: string): void {
  const db = _connections.get(dbPath);
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    _connections.delete(dbPath);
  }
}

// Cleanup on process exit
process.on('exit', () => {
  for (const db of _connections.values()) {
    try { db.close(); } catch { /* ignore */ }
  }
});
