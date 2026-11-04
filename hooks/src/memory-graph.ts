/**
 * Cross-Session Memory Graph - Stop hook
 * Session sonunda hata ve instinct verilerinden bilgi grafi olusturur.
 * DB: ~/.claude/cache/memory-graph.db (better-sqlite3)
 *
 * Node tipleri: error, instinct, session, file
 * Edge tipleri: caused_by, related_to, learned_from, fixed_by
 */
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type Database from 'better-sqlite3';
import { loadOptionalSqlite, reportSqliteUnavailable } from './shared/optional-sqlite.js';

interface ErrorEntry {
  ts: string;
  session: string;
  agent_id: string;
  agent_type: string;
  error_type: string;
  error_pattern: string;
  detail: string;
  file: string;
  lesson: string;
}

interface MatureInstinct {
  pattern: string;
  type: string;
  count: number;
  confidence: number;
  first_seen: string;
  last_seen: string;
  examples: string[];
  promoted: boolean;
}

const DB_PATH = join(homedir(), '.claude', 'cache', 'memory-graph.db');

function getDb(): Database.Database | null {
  const Sqlite = loadOptionalSqlite('memory-graph');
  if (!Sqlite) return null;
  mkdirSync(join(homedir(), '.claude', 'cache'), { recursive: true });
  const db = new Sqlite(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Schema olustur
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      data TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      weight REAL DEFAULT 1.0,
      created_at TEXT NOT NULL,
      UNIQUE(source_id, target_id, relation)
    );
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
  `);

  return db;
}

function upsertNode(db: Database.Database, id: string, type: string, label: string, data: Record<string, any>): void {
  db.prepare(`
    INSERT INTO nodes (id, type, label, data, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      data = excluded.data
  `).run(id, type, label, JSON.stringify(data), new Date().toISOString());
}

function upsertEdge(db: Database.Database, sourceId: string, targetId: string, relation: string, weight: number = 1.0): void {
  db.prepare(`
    INSERT INTO edges (source_id, target_id, relation, weight, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_id, target_id, relation) DO UPDATE SET
      weight = edges.weight + excluded.weight
  `).run(sourceId, targetId, relation, weight, new Date().toISOString());
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(l => l.trim());
  const results: T[] = [];
  for (const line of lines) {
    try { results.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return results;
}

function main() {
  // stdin oku (Stop hook formati)
  let raw = '';
  try { raw = readFileSync(0, 'utf-8'); } catch { /* ok */ }

  let sessionId = 'unknown';
  if (raw) {
    try {
      const input = JSON.parse(raw);
      sessionId = input.session_id?.slice(0, 8) || 'unknown';
    } catch { /* ok */ }
  }

  const claudeDir = join(homedir(), '.claude');
  const canavarDir = join(claudeDir, 'canavar');
  const ledgerPath = join(canavarDir, 'error-ledger.jsonl');
  const maturePath = join(claudeDir, 'mature-instincts.json');

  let db: Database.Database | null;
  try {
    db = getDb();
  } catch {
    reportSqliteUnavailable('memory-graph');
    console.log('{}');
    return;
  }
  if (!db) { console.log('{}'); return; }

  try {
    // Session node
    upsertNode(db, `session:${sessionId}`, 'session', `Session ${sessionId}`, {
      ts: new Date().toISOString(),
    });

    // Bu session'in hatalarini isle
    const allErrors = readJsonl<ErrorEntry>(ledgerPath);
    const sessionErrors = allErrors.filter(e => e.session === sessionId);

    for (const err of sessionErrors) {
      const errorId = `error:${err.error_pattern}:${err.session}`;
      const fileId = `file:${err.file}`;

      // Error node
      upsertNode(db, errorId, 'error', err.error_pattern, {
        type: err.error_type,
        detail: err.detail,
        lesson: err.lesson,
        agent: err.agent_type,
      });

      // File node
      if (err.file !== 'unknown') {
        upsertNode(db, fileId, 'file', err.file, {});
        upsertEdge(db, errorId, fileId, 'caused_by');
      }

      // Session -> Error edge
      upsertEdge(db, `session:${sessionId}`, errorId, 'related_to');
    }

    // Instinct'leri isle
    if (existsSync(maturePath)) {
      try {
        const instincts: MatureInstinct[] = JSON.parse(readFileSync(maturePath, 'utf-8'));

        for (const inst of instincts) {
          if (inst.confidence < 3) continue; // Cok dusuk confidence'lari atla

          const instinctId = `instinct:${inst.pattern}`;

          upsertNode(db, instinctId, 'instinct', inst.pattern, {
            type: inst.type,
            confidence: inst.confidence,
            promoted: inst.promoted,
            examples: inst.examples.slice(0, 3),
          });

          // Ayni pattern'deki hatalarla iliskilendir
          for (const err of allErrors) {
            if (err.error_pattern === inst.pattern || err.lesson.includes(inst.pattern)) {
              const errorId = `error:${err.error_pattern}:${err.session}`;
              upsertEdge(db, instinctId, errorId, 'learned_from');
            }
          }
        }
      } catch { /* skip */ }
    }

    // Ayni dosyada farkli session'larda olusan hatalari iliskilendir
    const fileErrors = new Map<string, string[]>();
    for (const err of allErrors) {
      if (err.file === 'unknown') continue;
      if (!fileErrors.has(err.file)) fileErrors.set(err.file, []);
      fileErrors.get(err.file)!.push(`error:${err.error_pattern}:${err.session}`);
    }

    for (const [, errorIds] of fileErrors) {
      if (errorIds.length >= 2) {
        // Ayni dosyadaki hatalar arasi related_to iliskisi
        for (let i = 0; i < errorIds.length - 1; i++) {
          for (let j = i + 1; j < Math.min(errorIds.length, i + 3); j++) {
            upsertEdge(db, errorIds[i], errorIds[j], 'related_to', 0.5);
          }
        }
      }
    }

    const nodeCount = (db.prepare('SELECT COUNT(*) as cnt FROM nodes').get() as any).cnt;
    const edgeCount = (db.prepare('SELECT COUNT(*) as cnt FROM edges').get() as any).cnt;

    console.log(JSON.stringify({
      result: `Memory graph: ${nodeCount} nodes, ${edgeCount} edges (session ${sessionId})`,
    }));
  } catch (e) {
    console.log(JSON.stringify({
      result: `Memory graph: hata - ${(e as Error).message?.slice(0, 100)}`,
    }));
  } finally {
    try { db.close(); } catch { /* ok */ }
  }
}

main();
