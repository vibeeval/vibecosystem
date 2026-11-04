// src/mcp-discovery.ts
import { readFileSync as readFileSync3, existsSync as existsSync2, mkdirSync as mkdirSync2, writeFileSync as writeFileSync2, readdirSync } from "node:fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";
import { createHash as createHash2 } from "node:crypto";

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

// src/mcp-discovery.ts
var MCP_MAPPINGS = [
  {
    name: "browser-use",
    signals: ["next.config.js", "next.config.ts", "next.config.mjs", "vite.config.ts", "vite.config.js"],
    description: "Frontend debug & browser automation",
    install: "pip3 install --user --break-system-packages browser-use"
  },
  {
    name: "github",
    signals: [".github"],
    description: "GitHub API - repos, issues, PRs",
    install: "npx -y @modelcontextprotocol/server-github"
  },
  {
    name: "docker",
    signals: ["docker-compose.yml", "docker-compose.yaml"],
    description: "Docker container management",
    install: "npx -y @modelcontextprotocol/server-docker"
  },
  {
    name: "postgres",
    signals: ["schema.prisma", "migrations"],
    description: "PostgreSQL database access",
    install: "npx -y @modelcontextprotocol/server-postgres"
  },
  {
    name: "kubernetes",
    signals: ["k8s", "kubernetes", "kustomization.yaml"],
    description: "Kubernetes cluster management",
    install: "npx -y @modelcontextprotocol/server-kubernetes"
  },
  {
    name: "codebase-memory",
    signals: ["docs", "documentation"],
    description: "Codebase indexing & semantic search",
    install: "Zaten kurulu: ~/bin/codebase-memory-mcp"
  },
  {
    name: "sqlite",
    signals: [],
    description: "SQLite database access",
    install: "npx -y @modelcontextprotocol/server-sqlite"
  },
  {
    name: "puppeteer",
    signals: ["playwright.config.ts", "playwright.config.js", "cypress.config.ts", "cypress.config.js"],
    description: "Browser automation & testing",
    install: "npx -y @modelcontextprotocol/server-puppeteer"
  }
];
function stateFile(sessionId, projectDir) {
  const key = createHash2("sha256").update(`${sessionId}\0${projectDir}`).digest("hex").slice(0, 24);
  return join2(homedir2(), ".claude", "cache", `mcp-discovery-${key}.json`);
}
function hasAlreadyFired(sessionId, projectDir) {
  const path = stateFile(sessionId, projectDir);
  if (!existsSync2(path)) return false;
  try {
    const state = JSON.parse(readFileSync3(path, "utf-8"));
    return state.session === sessionId;
  } catch {
    return false;
  }
}
function markFired(sessionId, projectDir) {
  const cacheDir = join2(homedir2(), ".claude", "cache");
  if (!existsSync2(cacheDir)) mkdirSync2(cacheDir, { recursive: true });
  writeFileSync2(stateFile(sessionId, projectDir), JSON.stringify({ session: sessionId, ts: (/* @__PURE__ */ new Date()).toISOString() }));
}
function getInstalledMcps() {
  const mcpConfigPath = join2(homedir2(), ".mcp.json");
  if (!existsSync2(mcpConfigPath)) return /* @__PURE__ */ new Set();
  try {
    const config = JSON.parse(readFileSync3(mcpConfigPath, "utf-8"));
    return new Set(Object.keys(config.mcpServers || {}));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function discoverMcps(projectDir) {
  const found = [];
  const installed = getInstalledMcps();
  for (const mapping of MCP_MAPPINGS) {
    if (installed.has(mapping.name)) continue;
    for (const signal of mapping.signals) {
      const checkPath = join2(projectDir, signal);
      if (existsSync2(checkPath)) {
        found.push(mapping);
        break;
      }
    }
  }
  if (!installed.has("postgres")) {
    try {
      const files = readdirSync(projectDir);
      if (files.some((f) => f.endsWith(".sql"))) {
        const pgMapping = MCP_MAPPINGS.find((m) => m.name === "postgres");
        if (pgMapping && !found.includes(pgMapping)) {
          found.push(pgMapping);
        }
      }
    } catch {
    }
  }
  if (!installed.has("sqlite")) {
    try {
      const files = readdirSync(projectDir);
      if (files.some((f) => f.endsWith(".db") || f.endsWith(".sqlite"))) {
        const sqliteMapping = MCP_MAPPINGS.find((m) => m.name === "sqlite");
        if (sqliteMapping && !found.includes(sqliteMapping)) {
          found.push(sqliteMapping);
        }
      }
    } catch {
    }
  }
  return found;
}
function main() {
  let input;
  try {
    input = readHookInput();
  } catch {
    console.log("{}");
    return;
  }
  if (input.tool_name !== "Read") {
    console.log("{}");
    return;
  }
  const sessionId = input.session_id || "unknown";
  const projectDir = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (hasAlreadyFired(sessionId, projectDir)) {
    console.log("{}");
    return;
  }
  const recommendations = discoverMcps(projectDir);
  if (recommendations.length === 0) {
    markFired(sessionId, projectDir);
    console.log("{}");
    return;
  }
  markFired(sessionId, projectDir);
  const lines = [
    "",
    "--- MCP Auto-Discovery ---",
    `Proje: ${projectDir}`,
    "",
    "Bu proje icin faydali olabilecek MCP server'lar:",
    ""
  ];
  for (const rec of recommendations) {
    lines.push(`  * ${rec.name}: ${rec.description}`);
    lines.push(`    Kurulum: ${rec.install}`);
    lines.push("");
  }
  lines.push("~/.mcp.json dosyasina ekleyerek aktive edebilirsiniz.");
  lines.push("---");
  console.log(JSON.stringify(budgetHookOutput({
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: lines.join("\n") }
  }, "mcp-discovery", "PreToolUse:Read")));
}
main();
