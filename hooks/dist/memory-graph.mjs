// src/memory-graph.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import Database from "better-sqlite3";
var DB_PATH = join(homedir(), ".claude", "cache", "memory-graph.db");
function getDb() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
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
function upsertNode(db, id, type, label, data) {
  db.prepare(`
    INSERT INTO nodes (id, type, label, data, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      data = excluded.data
  `).run(id, type, label, JSON.stringify(data), (/* @__PURE__ */ new Date()).toISOString());
}
function upsertEdge(db, sourceId, targetId, relation, weight = 1) {
  db.prepare(`
    INSERT INTO edges (source_id, target_id, relation, weight, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_id, target_id, relation) DO UPDATE SET
      weight = edges.weight + excluded.weight
  `).run(sourceId, targetId, relation, weight, (/* @__PURE__ */ new Date()).toISOString());
}
function readJsonl(path) {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf-8").split("\n").filter((l) => l.trim());
  const results = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch {
    }
  }
  return results;
}
function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf-8");
  } catch {
  }
  let sessionId = "unknown";
  if (raw) {
    try {
      const input = JSON.parse(raw);
      sessionId = input.session_id?.slice(0, 8) || "unknown";
    } catch {
    }
  }
  const claudeDir = join(homedir(), ".claude");
  const canavarDir = join(claudeDir, "canavar");
  const ledgerPath = join(canavarDir, "error-ledger.jsonl");
  const maturePath = join(claudeDir, "mature-instincts.json");
  let db;
  try {
    db = getDb();
  } catch (e) {
    console.log(JSON.stringify({ result: "Memory graph: DB baglantisi basarisiz" }));
    return;
  }
  try {
    upsertNode(db, `session:${sessionId}`, "session", `Session ${sessionId}`, {
      ts: (/* @__PURE__ */ new Date()).toISOString()
    });
    const allErrors = readJsonl(ledgerPath);
    const sessionErrors = allErrors.filter((e) => e.session === sessionId);
    for (const err of sessionErrors) {
      const errorId = `error:${err.error_pattern}:${err.session}`;
      const fileId = `file:${err.file}`;
      upsertNode(db, errorId, "error", err.error_pattern, {
        type: err.error_type,
        detail: err.detail,
        lesson: err.lesson,
        agent: err.agent_type
      });
      if (err.file !== "unknown") {
        upsertNode(db, fileId, "file", err.file, {});
        upsertEdge(db, errorId, fileId, "caused_by");
      }
      upsertEdge(db, `session:${sessionId}`, errorId, "related_to");
    }
    if (existsSync(maturePath)) {
      try {
        const instincts = JSON.parse(readFileSync(maturePath, "utf-8"));
        for (const inst of instincts) {
          if (inst.confidence < 3) continue;
          const instinctId = `instinct:${inst.pattern}`;
          upsertNode(db, instinctId, "instinct", inst.pattern, {
            type: inst.type,
            confidence: inst.confidence,
            promoted: inst.promoted,
            examples: inst.examples.slice(0, 3)
          });
          for (const err of allErrors) {
            if (err.error_pattern === inst.pattern || err.lesson.includes(inst.pattern)) {
              const errorId = `error:${err.error_pattern}:${err.session}`;
              upsertEdge(db, instinctId, errorId, "learned_from");
            }
          }
        }
      } catch {
      }
    }
    const fileErrors = /* @__PURE__ */ new Map();
    for (const err of allErrors) {
      if (err.file === "unknown") continue;
      if (!fileErrors.has(err.file)) fileErrors.set(err.file, []);
      fileErrors.get(err.file).push(`error:${err.error_pattern}:${err.session}`);
    }
    for (const [, errorIds] of fileErrors) {
      if (errorIds.length >= 2) {
        for (let i = 0; i < errorIds.length - 1; i++) {
          for (let j = i + 1; j < Math.min(errorIds.length, i + 3); j++) {
            upsertEdge(db, errorIds[i], errorIds[j], "related_to", 0.5);
          }
        }
      }
    }
    const nodeCount = db.prepare("SELECT COUNT(*) as cnt FROM nodes").get().cnt;
    const edgeCount = db.prepare("SELECT COUNT(*) as cnt FROM edges").get().cnt;
    console.log(JSON.stringify({
      result: `Memory graph: ${nodeCount} nodes, ${edgeCount} edges (session ${sessionId})`
    }));
  } catch (e) {
    console.log(JSON.stringify({
      result: `Memory graph: hata - ${e.message?.slice(0, 100)}`
    }));
  } finally {
    try {
      db.close();
    } catch {
    }
  }
}
main();
