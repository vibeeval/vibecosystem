// src/agent-memory-loader.ts
import { readFileSync as readFileSync4, existsSync as existsSync3, readdirSync, statSync as statSync2 } from "fs";
import { join as join3 } from "path";

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
import { readFileSync as readFileSync2 } from "node:fs";
function readHookInput(raw = readFileSync2(0, "utf-8")) {
  const input = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Hook input must be a JSON object");
  }
  configureContextBudget(input);
  return input;
}

// src/shared/agent-memory.ts
import { existsSync as existsSync2, readFileSync as readFileSync3 } from "node:fs";
import { join as join2, resolve as resolve2 } from "node:path";
import { homedir as homedir2 } from "node:os";
function sanitizeAgentType(agentType) {
  return agentType.replace(/[:/\\\s]+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "").replace(/^\.+|\.+$/g, "").toLowerCase() || "unknown";
}
function agentProjectDir(cwd) {
  return resolve2(cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}
function getAgentMemoryScope(agentType, cwd) {
  if (!/^[a-zA-Z0-9_:-]+$/.test(agentType)) return "user";
  const files = [
    join2(agentProjectDir(cwd), ".claude", "agents", `${agentType}.md`),
    join2(homedir2(), ".claude", "agents", `${agentType}.md`)
  ];
  for (const file of files) {
    if (!existsSync2(file)) continue;
    try {
      const frontmatter = readFileSync3(file, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const scope2 = frontmatter?.[1].match(/^memory:\s*['"]?(user|project|local)['"]?\s*$/m)?.[1];
      if (scope2) return scope2;
    } catch {
    }
  }
  return "user";
}
function getAgentMemoryDir(agentType, scope2, cwd) {
  const name = sanitizeAgentType(agentType);
  if (scope2 === "user") return join2(homedir2(), ".claude", "agent-memory", name);
  return join2(agentProjectDir(cwd), ".claude", scope2 === "local" ? "agent-memory-local" : "agent-memory", name);
}

// src/agent-memory-loader.ts
var MAX_MEMORY_SIZE = 8e3;
var MAX_FILES = 10;
function scanMemoryDir(dir) {
  if (!existsSync3(dir)) return [];
  const results = [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).slice(0, MAX_FILES);
    for (const file of files) {
      const filePath = join3(dir, file);
      try {
        const stat = statSync2(filePath);
        if (stat.isFile() && stat.size > 0 && stat.size < 5e4) {
          const content = readFileSync4(filePath, "utf-8").trim();
          if (content) {
            results.push(`### ${file}
${content}`);
          }
        }
      } catch {
      }
    }
  } catch {
  }
  return results;
}
function main() {
  try {
    const input = readHookInput();
    if (input.tool_name !== "Agent") return;
    const agentType = input.tool_input?.subagent_type;
    if (!agentType) return;
    const effectiveScope = getAgentMemoryScope(agentType, input.cwd);
    const memoryDir = getAgentMemoryDir(agentType, effectiveScope, input.cwd);
    const memories = scanMemoryDir(memoryDir);
    if (memories.length === 0) return;
    let combined = memories.join("\n\n");
    if (combined.length > MAX_MEMORY_SIZE) {
      combined = combined.substring(0, MAX_MEMORY_SIZE) + "\n\n[... truncated]";
    }
    const context = `## Agent Persistent Memory (${agentType}, scope: ${effectiveScope})

Bu agent'in onceki session'lardan biriktirdigi kalici bellek:

${combined}

---
Bu memory'yi guncelle: Yeni ogrenimler varsa ${memoryDir}/ dizinine yaz.
Memory guncelleme zorunlu DEGiL - sadece gercekten yeni ve degerli bilgi varsa kaydet.`;
    const result = {
      hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: context }
    };
    process.stdout.write(JSON.stringify(budgetHookOutput(result, "agent-memory-loader", "PreToolUse:Agent")));
  } catch {
  }
}
main();
