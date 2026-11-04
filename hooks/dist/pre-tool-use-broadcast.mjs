#!/usr/bin/env node

// src/pre-tool-use-broadcast.ts
import { existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";

// src/shared/optional-sqlite.ts
import { createRequire } from "node:module";
function reportSqliteUnavailable(hook) {
  console.error(`[${hook}] SQLite operation skipped: optional better-sqlite3 is missing or incompatible. Install a Node-compatible version in the hooks directory (for a managed install: ~/.claude/hooks), or use the core profile.`);
}
function loadOptionalSqlite(hook) {
  try {
    return createRequire(import.meta.url)("better-sqlite3");
  } catch {
    reportSqliteUnavailable(hook);
    return null;
  }
}

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

// src/pre-tool-use-broadcast.ts
var SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
function queryBroadcasts(dbPath, swarmId, agentId) {
  if (!existsSync2(dbPath)) {
    return [];
  }
  const Sqlite = loadOptionalSqlite("pre-tool-use-broadcast");
  if (!Sqlite) return [];
  let db = null;
  try {
    db = new Sqlite(dbPath, { readonly: true });
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
    console.error("[pre-tool-use-broadcast] SQLite broadcast query failed; no broadcasts were loaded.");
    return [];
  } finally {
    try {
      db?.close();
    } catch {
    }
  }
}
async function main() {
  try {
    readHookInput();
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
  const dbPath = join2(
    projectDir,
    ".claude",
    "cache",
    "agentica-coordination",
    "coordination.db"
  );
  if (!existsSync2(dbPath)) {
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
      console.log(JSON.stringify(budgetHookOutput({
        hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: contextMessage }
      }, "pre-tool-use-broadcast", "PreToolUse")));
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
