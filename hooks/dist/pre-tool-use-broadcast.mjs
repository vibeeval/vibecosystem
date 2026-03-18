#!/usr/bin/env node

// src/pre-tool-use-broadcast.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
var SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
function queryBroadcasts(dbPath, swarmId, agentId) {
  if (!existsSync(dbPath)) {
    return [];
  }
  let db = null;
  try {
    db = new Database(dbPath, { readonly: true });
    db.pragma("busy_timeout = 5000");
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='broadcasts'"
    ).get();
    if (!tableExists) {
      return [];
    }
    const rows = db.prepare(`
            SELECT sender_agent, broadcast_type, payload, created_at
            FROM broadcasts
            WHERE swarm_id = ? AND sender_agent != ?
            ORDER BY created_at DESC
            LIMIT 10
        `).all(swarmId, agentId);
    const broadcasts = [];
    for (const row of rows) {
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(row.payload);
      } catch {
        continue;
      }
      broadcasts.push({
        sender: row.sender_agent,
        type: row.broadcast_type,
        payload: parsedPayload,
        time: row.created_at
      });
    }
    return broadcasts;
  } catch {
    return [];
  } finally {
    try {
      db?.close();
    } catch {
    }
  }
}
async function main() {
  const input = readFileSync(0, "utf-8");
  try {
    JSON.parse(input);
  } catch {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const swarmId = process.env.SWARM_ID;
  if (!swarmId) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  if (!SAFE_ID_PATTERN.test(swarmId)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const agentId = process.env.AGENT_ID || "unknown";
  if (agentId !== "unknown" && !SAFE_ID_PATTERN.test(agentId)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const dbPath = join(
    projectDir,
    ".claude",
    "cache",
    "agentica-coordination",
    "coordination.db"
  );
  if (!existsSync(dbPath)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  try {
    const broadcasts = queryBroadcasts(dbPath, swarmId, agentId);
    if (broadcasts.length > 0) {
      let contextMessage = "\n--- SWARM BROADCASTS ---\n";
      for (const b of broadcasts) {
        contextMessage += `[${b.type.toUpperCase()}] from ${b.sender}:
`;
        contextMessage += `  ${JSON.stringify(b.payload)}
`;
      }
      contextMessage += "------------------------\n";
      console.log(JSON.stringify({
        result: "continue",
        message: contextMessage
      }));
    } else {
      console.log(JSON.stringify({ result: "continue" }));
    }
  } catch (err) {
    console.error("Broadcast query error:", err);
    console.log(JSON.stringify({ result: "continue" }));
  }
}
var isDirectExecution = process.argv[1]?.endsWith("pre-tool-use-broadcast.mjs") || process.argv[1]?.endsWith("pre-tool-use-broadcast.ts");
if (isDirectExecution) {
  main().catch((err) => {
    console.error("Uncaught error:", err);
    console.log(JSON.stringify({ result: "continue" }));
  });
}
export {
  queryBroadcasts
};
