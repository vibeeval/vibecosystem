// src/smart-memory-recall.ts
import { readFileSync as readFileSync3, existsSync as existsSync2, readdirSync, statSync as statSync2, openSync, readSync, closeSync } from "node:fs";
import { join as join3 } from "path";
import { homedir as homedir2 } from "os";

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
import { join as join2, resolve as resolve2 } from "node:path";
function agentProjectDir(cwd) {
  return resolve2(cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

// src/smart-memory-recall.ts
var CLAUDE_HOME = join3(homedir2(), ".claude");
var MAX_RESULTS = 3;
var MAX_CONTEXT_SIZE = 4e3;
var FRONTMATTER_MAX_BYTES = 2e3;
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "", type: "" };
  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  const typeMatch = fm.match(/^type:\s*(.+)$/m);
  return {
    name: nameMatch?.[1]?.trim() || "",
    description: descMatch?.[1]?.trim() || "",
    type: typeMatch?.[1]?.trim() || ""
  };
}
function scanDir(dir) {
  if (!existsSync2(dir)) return [];
  const results = [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
    for (const file of files) {
      const filePath = join3(dir, file);
      try {
        const stat = statSync2(filePath);
        if (!stat.isFile() || stat.size === 0) continue;
        const fd = openSync(filePath, "r");
        const buf = Buffer.alloc(Math.min(FRONTMATTER_MAX_BYTES, stat.size));
        try {
          readSync(fd, buf, 0, buf.length, 0);
        } finally {
          closeSync(fd);
        }
        const content = buf.toString("utf-8");
        const fm = parseFrontmatter(content);
        results.push({
          filename: file,
          filePath,
          name: fm.name || file.replace(".md", ""),
          description: fm.description,
          type: fm.type,
          mtimeMs: stat.mtimeMs,
          score: 0
        });
      } catch {
      }
    }
  } catch {
  }
  return results;
}
function scanAllMemories(cwd) {
  const projectDir = agentProjectDir(cwd);
  const projectKey = projectDir.replace(/[^a-zA-Z0-9]/g, "-");
  const headers = scanDir(join3(CLAUDE_HOME, "projects", projectKey, "memory"));
  const agentRoots = [
    join3(CLAUDE_HOME, "agent-memory"),
    join3(projectDir, ".claude", "agent-memory"),
    join3(projectDir, ".claude", "agent-memory-local")
  ];
  for (const root of agentRoots) {
    try {
      for (const agent of readdirSync(root, { withFileTypes: true })) {
        if (agent.isDirectory()) headers.push(...scanDir(join3(root, agent.name)));
      }
    } catch {
    }
  }
  return headers;
}
function scoreMemories(headers, query) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return [];
  for (const header of headers) {
    let score = 0;
    const searchText = `${header.name} ${header.description} ${header.filename} ${header.type}`.toLowerCase();
    for (const word of queryWords) {
      if (searchText.includes(word)) {
        score += 10;
      }
    }
    if (searchText.includes(queryLower.substring(0, 30))) {
      score += 20;
    }
    const filenameLower = header.filename.toLowerCase().replace(".md", "").replace(/[-_]/g, " ");
    for (const word of queryWords) {
      if (filenameLower.includes(word)) {
        score += 15;
      }
    }
    if (score === 0) {
      header.score = 0;
      continue;
    }
    if (header.type === "feedback") score += 5;
    if (header.type === "project") score += 3;
    const ageMs = Date.now() - header.mtimeMs;
    if (ageMs < 7 * 24 * 60 * 60 * 1e3) score += 5;
    else if (ageMs < 30 * 24 * 60 * 60 * 1e3) score += 2;
    header.score = score;
  }
  return headers.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
function loadMemoryContents(selected) {
  const parts = [];
  let totalSize = 0;
  for (const mem of selected) {
    try {
      let content = readFileSync3(mem.filePath, "utf-8").trim();
      if (totalSize + content.length > MAX_CONTEXT_SIZE) {
        const remaining2 = MAX_CONTEXT_SIZE - totalSize;
        if (remaining2 < 200) break;
        content = content.substring(0, remaining2) + "\n[... truncated]";
      }
      parts.push(`### ${mem.name} (${mem.type || "unknown"}, score: ${mem.score})
*Source: ${mem.filename}*

${content}`);
      totalSize += content.length;
    } catch {
    }
  }
  return parts.join("\n\n---\n\n");
}
async function main() {
  const input = readHookInput();
  if (process.env.CLAUDE_AGENT_ID) return;
  if (typeof input.prompt !== "string" || input.prompt.length < 15) return;
  if (input.prompt.trim().startsWith("/")) return;
  const allHeaders = scanAllMemories(input.cwd);
  if (allHeaders.length === 0) return;
  const selected = scoreMemories(allHeaders, input.prompt);
  if (selected.length === 0) return;
  const contents = loadMemoryContents(selected);
  if (!contents) return;
  const context = `## Smart Memory Recall (${selected.length} relevant memories found)

${contents}

---
*Memory recall otomatik. Alakali icerik varsa kullan, yoksa yok say.*`;
  const output = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context
    }
  };
  console.log(JSON.stringify(budgetHookOutput(output, "smart-memory-recall", "UserPromptSubmit")));
}
main().catch(() => {
});
