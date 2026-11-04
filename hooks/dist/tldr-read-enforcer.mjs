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
var HOOK_RELEVANCE = {
  "tldr-read-enforcer": ["implementation", "debug", "research"],
  "smart-search-router": ["implementation", "debug", "research"],
  "signature-helper": ["implementation"],
  "arch-context-inject": ["implementation", "planning"],
  "compiler-in-the-loop": ["implementation", "debug"],
  "edit-context-inject": ["implementation"],
  "impact-refactor": ["implementation"]
};
function isRelevantForIntent(hookName) {
  const relevantTypes = HOOK_RELEVANCE[hookName];
  if (!relevantTypes) return true;
  try {
    const intentPath = join(homedir(), ".claude", "cache", "current-intent.json");
    if (!existsSync(intentPath)) return true;
    const fileStat = statSync(intentPath);
    const ageMs = Date.now() - fileStat.mtimeMs;
    if (ageMs > 30 * 60 * 1e3) return true;
    const intent = JSON.parse(readFileSync(intentPath, "utf-8"));
    if (!scope.sessionId || intent.session_id !== scope.sessionId && intent.session_id !== scope.sessionId.slice(0, 8)) return true;
    const taskType = intent.task_type || "conversational";
    return relevantTypes.includes(taskType);
  } catch {
    return true;
  }
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

// src/tldr-read-enforcer.ts
import { readFileSync as readFileSync5, existsSync as existsSync4, statSync as statSync3 } from "fs";
import { basename as basename2, extname, join as join4, resolve as resolve3 } from "path";

// src/daemon-client.ts
import { existsSync as existsSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2, unlinkSync } from "fs";
import { execSync, spawnSync } from "child_process";
import { join as join2, resolve as resolve2 } from "path";
import { tmpdir } from "os";
import * as net from "net";
import * as crypto from "crypto";
function resolveProjectDir(projectDir) {
  return resolve2(projectDir);
}
function getLockPath(projectDir) {
  const resolvedPath = resolveProjectDir(projectDir);
  const hash = crypto.createHash("md5").update(resolvedPath).digest("hex").substring(0, 8);
  return `${tmpdir()}/tldr-${hash}.lock`;
}
function getPidPath(projectDir) {
  const resolvedPath = resolveProjectDir(projectDir);
  const hash = crypto.createHash("md5").update(resolvedPath).digest("hex").substring(0, 8);
  return `${tmpdir()}/tldr-${hash}.pid`;
}
function isDaemonProcessRunning(projectDir) {
  const pidPath = getPidPath(projectDir);
  if (!existsSync2(pidPath)) return false;
  try {
    const pid = parseInt(readFileSync3(pidPath, "utf-8").trim(), 10);
    if (isNaN(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function tryAcquireLock(projectDir) {
  const lockPath = getLockPath(projectDir);
  try {
    if (existsSync2(lockPath)) {
      const lockContent = readFileSync3(lockPath, "utf-8");
      const lockTime = parseInt(lockContent, 10);
      if (!isNaN(lockTime) && Date.now() - lockTime < 3e4) {
        return false;
      }
      try {
        unlinkSync(lockPath);
      } catch {
      }
    }
    writeFileSync2(lockPath, Date.now().toString(), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}
function releaseLock(projectDir) {
  try {
    unlinkSync(getLockPath(projectDir));
  } catch {
  }
}
var QUERY_TIMEOUT = 3e3;
function getConnectionInfo(projectDir) {
  const resolvedPath = resolveProjectDir(projectDir);
  const hash = crypto.createHash("md5").update(resolvedPath).digest("hex").substring(0, 8);
  if (process.platform === "win32") {
    const port = 49152 + parseInt(hash, 16) % 1e4;
    return { type: "tcp", host: "127.0.0.1", port };
  } else {
    return { type: "unix", path: `${tmpdir()}/tldr-${hash}.sock` };
  }
}
function getStatusFile(projectDir) {
  const statusPath = join2(projectDir, ".tldr", "status");
  if (existsSync2(statusPath)) {
    try {
      return readFileSync3(statusPath, "utf-8").trim();
    } catch {
      return null;
    }
  }
  return null;
}
function isIndexing(projectDir) {
  return getStatusFile(projectDir) === "indexing";
}
function isDaemonReachable(projectDir) {
  const connInfo = getConnectionInfo(projectDir);
  if (connInfo.type === "tcp") {
    try {
      const testSocket = new net.Socket();
      testSocket.setTimeout(100);
      let connected = false;
      testSocket.on("connect", () => {
        connected = true;
        testSocket.destroy();
      });
      testSocket.on("error", () => {
        testSocket.destroy();
      });
      testSocket.connect(connInfo.port, connInfo.host);
      const end = Date.now() + 200;
      while (Date.now() < end && !connected) {
      }
      return connected;
    } catch {
      return false;
    }
  } else {
    if (!existsSync2(connInfo.path)) {
      return false;
    }
    if (isDaemonProcessRunning(projectDir)) {
      try {
        execSync(`nc -U "${connInfo.path}"`, {
          input: '{"cmd":"ping"}\n',
          encoding: "utf-8",
          timeout: 1e3,
          // Increased from 500ms
          stdio: ["pipe", "pipe", "pipe"]
        });
        return true;
      } catch {
        return true;
      }
    }
    try {
      execSync(`nc -U "${connInfo.path}"`, {
        input: '{"cmd":"ping"}\n',
        encoding: "utf-8",
        timeout: 500,
        stdio: ["pipe", "pipe", "pipe"]
      });
      return true;
    } catch {
      try {
        unlinkSync(connInfo.path);
      } catch {
      }
      return false;
    }
  }
}
function tryStartDaemon(projectDir) {
  try {
    if (isDaemonProcessRunning(projectDir)) {
      return true;
    }
    if (isDaemonReachable(projectDir)) {
      return true;
    }
    if (!tryAcquireLock(projectDir)) {
      const start = Date.now();
      while (Date.now() - start < 5e3) {
        if (isDaemonProcessRunning(projectDir) || isDaemonReachable(projectDir)) {
          return true;
        }
        const end = Date.now() + 100;
        while (Date.now() < end) {
        }
      }
      return isDaemonProcessRunning(projectDir) || isDaemonReachable(projectDir);
    }
    try {
      const tldrPath = join2(projectDir, "opc", "packages", "tldr-code");
      let started = false;
      if (existsSync2(tldrPath)) {
        const result = spawnSync("uv", ["run", "tldr", "daemon", "start", "--project", projectDir], {
          timeout: 1e4,
          stdio: "ignore",
          cwd: tldrPath
        });
        started = result.status === 0;
      }
      if (!started && !process.env.TLDR_DEV) {
        spawnSync("tldr", ["daemon", "start", "--project", projectDir], {
          timeout: 5e3,
          stdio: "ignore"
        });
      }
      const start = Date.now();
      while (Date.now() - start < 1e4) {
        if (isDaemonReachable(projectDir)) {
          const cooldown = Date.now() + 1e3;
          while (Date.now() < cooldown) {
          }
          return true;
        }
        const end = Date.now() + 100;
        while (Date.now() < end) {
        }
      }
      return isDaemonReachable(projectDir);
    } finally {
      releaseLock(projectDir);
    }
  } catch {
    return false;
  }
}
function queryDaemonSync(query, projectDir) {
  if (isIndexing(projectDir)) {
    return {
      indexing: true,
      status: "indexing",
      message: "Daemon is still indexing, results may be incomplete"
    };
  }
  const connInfo = getConnectionInfo(projectDir);
  if (!isDaemonReachable(projectDir)) {
    if (!tryStartDaemon(projectDir)) {
      return { status: "unavailable", error: "Daemon not running and could not start" };
    }
  }
  try {
    const input = JSON.stringify(query);
    let result;
    if (connInfo.type === "tcp") {
      const psCommand = `
        $client = New-Object System.Net.Sockets.TcpClient('${connInfo.host}', ${connInfo.port})
        $stream = $client.GetStream()
        $writer = New-Object System.IO.StreamWriter($stream)
        $reader = New-Object System.IO.StreamReader($stream)
        $writer.WriteLine('${input.replace(/'/g, "''")}')
        $writer.Flush()
        $response = $reader.ReadLine()
        $client.Close()
        Write-Output $response
      `.trim();
      result = execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, {
        encoding: "utf-8",
        timeout: QUERY_TIMEOUT
      });
    } else {
      result = execSync(`nc -U "${connInfo.path}"`, {
        input: input + "\n",
        encoding: "utf-8",
        timeout: QUERY_TIMEOUT
      });
    }
    return JSON.parse(result.trim());
  } catch (err) {
    if (err.killed) {
      return { status: "error", error: "timeout" };
    }
    if (err.message?.includes("ECONNREFUSED") || err.message?.includes("ENOENT")) {
      return { status: "unavailable", error: "Daemon not running" };
    }
    return { status: "error", error: err.message || "Unknown error" };
  }
}
function trackHookActivitySync(hookName, projectDir, success = true, metrics = {}) {
  try {
    queryDaemonSync(
      { cmd: "track", hook: hookName, success, metrics },
      projectDir
    );
  } catch {
  }
}

// src/shared/hook-profiler.ts
import { mkdirSync as mkdirSync2, existsSync as existsSync3 } from "fs";
import { join as join3 } from "path";
import { homedir as homedir2 } from "os";

// src/shared/log-rotation.ts
import { statSync as statSync2, readFileSync as readFileSync4, writeFileSync as writeFileSync3, appendFileSync, renameSync as renameSync2, unlinkSync as unlinkSync2 } from "fs";
function appendWithRotation(filePath, line, maxBytes = 2 * 1024 * 1024, keepLines = 5e3) {
  appendFileSync(filePath, line, { mode: 384 });
  try {
    const stats = statSync2(filePath);
    if (stats.size > maxBytes) {
      const tmpPath = filePath + ".rotating";
      try {
        renameSync2(filePath, tmpPath);
        const content = readFileSync4(tmpPath, "utf-8");
        const lines = content.split("\n").filter((l) => l.length > 0);
        writeFileSync3(filePath, lines.slice(-keepLines).join("\n") + "\n");
        unlinkSync2(tmpPath);
      } catch {
      }
    }
  } catch {
  }
}

// src/shared/hook-profiler.ts
var PERF_LOG = join3(homedir2(), ".claude", "cache", "hook-perf.jsonl");
var MAX_LOG_SIZE = 1024 * 1024;
function startTimer() {
  return process.hrtime.bigint();
}
function endTimer(start, hookName, eventType, sessionId = "unknown") {
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  const entry = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    hook: hookName,
    event: eventType,
    duration_ms: Math.round(elapsed * 100) / 100,
    session: sessionId.slice(0, 8)
  };
  try {
    const cacheDir = join3(homedir2(), ".claude", "cache");
    if (!existsSync3(cacheDir)) mkdirSync2(cacheDir, { recursive: true });
    appendWithRotation(PERF_LOG, JSON.stringify(entry) + "\n", MAX_LOG_SIZE, 3e3);
  } catch {
  }
}

// src/tldr-read-enforcer.ts
import { homedir as homedir3 } from "node:os";
import { createHash as createHash3 } from "node:crypto";
var CONTEXT_DIR = join4(homedir3(), ".claude", "cache", "search-context");
var CONTEXT_MAX_AGE_MS = 3e4;
function getSearchContext(sessionId, project) {
  try {
    const key = createHash3("sha256").update(JSON.stringify([resolve3(project), sessionId])).digest("hex");
    const contextPath = join4(CONTEXT_DIR, `${key}.json`);
    if (!existsSync4(contextPath)) return null;
    const context = JSON.parse(readFileSync5(contextPath, "utf-8"));
    if (Date.now() - context.timestamp > CONTEXT_MAX_AGE_MS) {
      return null;
    }
    return context;
  } catch {
    return null;
  }
}
var CODE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".py",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".go",
  ".rs"
]);
var ALLOWED_PATTERNS = [
  /\.json$/,
  /\.yaml$/,
  /\.yml$/,
  /\.toml$/,
  /\.md$/,
  /\.txt$/,
  /\.env/,
  /\.gitignore$/,
  /Makefile$/,
  /Dockerfile$/,
  /requirements\.txt$/,
  /package\.json$/,
  /tsconfig\.json$/,
  /pyproject\.toml$/,
  // Allow test files (need full context for implementation)
  /test_.*\.py$/,
  /.*_test\.py$/,
  /.*\.test\.(ts|js)$/,
  /.*\.spec\.(ts|js)$/,
  // Allow hooks/skills (we edit these)
  /\.claude\/hooks\//,
  /\.claude\/skills\//,
  /init-db\.sql$/,
  /migrations\//
];
var ALLOWED_DIRS = ["/tmp/", "node_modules/", ".venv/", "__pycache__/"];
function isCodeFile(filePath) {
  return CODE_EXTENSIONS.has(extname(filePath));
}
function isAllowedFile(filePath) {
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  for (const dir of ALLOWED_DIRS) {
    if (filePath.includes(dir)) return true;
  }
  return false;
}
function detectLanguage(filePath) {
  const ext = extname(filePath);
  const langMap = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".go": "go",
    ".rs": "rust"
  };
  return langMap[ext] || "python";
}
function chooseTldrMode(target, layers, contextSource) {
  const fromSearchRouter = contextSource.startsWith("function:") || contextSource.startsWith("class:");
  if (target && fromSearchRouter) {
    return { mode: "context", reason: `search: ${target}` };
  }
  if (layers.some((l) => ["cfg", "dfg", "pdg"].includes(l))) {
    return { mode: "extract", reason: "flow analysis" };
  }
  return { mode: "structure", reason: "navigation" };
}
function getTldrContext(filePath, language, layers = ["ast", "call_graph"], target = null, sessionId = null, contextSource = "default") {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const fileName = basename2(filePath);
  const results = [];
  const { mode, reason } = chooseTldrMode(target, layers, contextSource);
  try {
    results.push(`# ${fileName}`);
    results.push(`Language: ${language}`);
    results.push(`Mode: ${mode} (${reason})`);
    results.push("");
    if (mode === "context" && target) {
      const contextResp = queryDaemonSync(
        { cmd: "context", entry: target, language, depth: 2 },
        projectDir
      );
      if (contextResp.status === "ok" && contextResp.result) {
        results.push("## Focused Context");
        results.push(typeof contextResp.result === "string" ? contextResp.result : JSON.stringify(contextResp.result, null, 2));
        results.push("");
        results.push("---");
        results.push("To see more: Read with offset/limit, or ask about specific functions");
        return results.join("\n");
      }
    }
    if (mode === "structure") {
      const extractResp = queryDaemonSync(
        { cmd: "extract", file: filePath, session: sessionId || void 0 },
        projectDir
      );
      if (extractResp.status === "ok" && extractResp.result) {
        results.push("## Structure (names only)");
        const info = extractResp.result;
        if (info.functions?.length > 0) {
          results.push("### Functions");
          for (const fn of info.functions.slice(0, 30)) {
            const params = fn.params ? `(${fn.params.slice(0, 3).join(", ")}${fn.params.length > 3 ? "..." : ""})` : "()";
            results.push(`  ${fn.name}${params}  [line ${fn.line_number || fn.line || "?"}]`);
            if (fn.docstring) {
              const firstLine = fn.docstring.split("\n")[0].trim().slice(0, 80);
              results.push(`    # ${firstLine}`);
            }
          }
        }
        if (info.classes?.length > 0) {
          results.push("### Classes");
          for (const cls of info.classes.slice(0, 20)) {
            const methods = cls.methods?.slice(0, 5).map((m) => m.name).join(", ") || "";
            results.push(`  ${cls.name}  [line ${cls.line_number || cls.line || "?"}]`);
            if (cls.docstring) {
              const firstLine = cls.docstring.split("\n")[0].trim().slice(0, 80);
              results.push(`    # ${firstLine}`);
            }
            if (methods) results.push(`    methods: ${methods}${cls.methods?.length > 5 ? "..." : ""}`);
          }
        }
        results.push("");
        results.push("---");
        results.push("To see full code: Read with limit=100 (or offset=N limit=M for specific lines)");
        return results.join("\n");
      }
    }
    if (layers.includes("ast") || layers.includes("call_graph") || mode === "extract") {
      const extractResp = queryDaemonSync(
        { cmd: "extract", file: filePath, session: sessionId || void 0 },
        projectDir
      );
      if (extractResp.status === "ok" && extractResp.result) {
        const info = extractResp.result;
        if (info.functions && info.functions.length > 0) {
          results.push("## Functions");
          for (const fn of info.functions) {
            const params = fn.params ? fn.params.join(", ") : "";
            const ret = fn.return_type ? ` -> ${fn.return_type}` : "";
            results.push(`  ${fn.name}(${params})${ret}  [line ${fn.line_number || fn.line}]`);
            if (fn.docstring) {
              const doc = fn.docstring.substring(0, 100).replace(/\n/g, " ");
              results.push(`    # ${doc}`);
            }
          }
        }
        if (info.classes && info.classes.length > 0) {
          results.push("");
          results.push("## Classes");
          for (const cls of info.classes) {
            results.push(`  class ${cls.name}  [line ${cls.line_number || cls.line}]`);
            if (cls.methods) {
              for (const m of cls.methods.slice(0, 10)) {
                results.push(`    .${m.name}()`);
              }
            }
          }
        }
        if (layers.includes("call_graph") && info.call_graph && info.call_graph.calls) {
          results.push("");
          results.push("## Call Graph");
          const entries = Object.entries(info.call_graph.calls).slice(0, 15);
          for (const [caller, callees] of entries) {
            results.push(`  ${caller} -> ${callees}`);
          }
        }
      }
    }
    if (layers.includes("cfg")) {
      const funcName = target || "main";
      const cfgResp = queryDaemonSync(
        { cmd: "cfg", file: filePath, function: funcName, language },
        projectDir
      );
      if (cfgResp.status === "ok" && cfgResp.result) {
        const cfg = cfgResp.result;
        results.push("");
        results.push(`## CFG: ${funcName}`);
        results.push(`  Blocks: ${cfg.num_blocks || "N/A"}, Cyclomatic: ${cfg.cyclomatic_complexity || "N/A"}`);
        if (cfg.blocks && Array.isArray(cfg.blocks)) {
          for (const b of cfg.blocks.slice(0, 8)) {
            results.push(`    Block ${b.id}: lines ${b.start_line}-${b.end_line} (${b.block_type})`);
          }
        }
      }
    }
    if (layers.includes("dfg")) {
      const funcName = target || "main";
      const dfgResp = queryDaemonSync(
        { cmd: "dfg", file: filePath, function: funcName, language },
        projectDir
      );
      if (dfgResp.status === "ok" && dfgResp.result) {
        const dfg = dfgResp.result;
        results.push("");
        results.push(`## DFG: ${funcName}`);
        if (dfg.definitions && dfg.definitions.length > 0) {
          results.push("  Definitions:");
          for (const d of dfg.definitions.slice(0, 10)) {
            results.push(`    ${d.var_name} @ line ${d.line}`);
          }
        }
        if (dfg.uses && dfg.uses.length > 0) {
          results.push("  Uses:");
          for (const u of dfg.uses.slice(0, 8)) {
            results.push(`    ${u.var_name} @ line ${u.line}`);
          }
        }
      }
    }
    if (layers.includes("pdg")) {
      const funcName = target || "main";
      const sliceResp = queryDaemonSync(
        { cmd: "slice", file: filePath, function: funcName, line: 10, direction: "backward" },
        projectDir
      );
      if (sliceResp.status === "ok" && sliceResp.result) {
        const slice = sliceResp.result;
        results.push("");
        results.push(`## PDG: ${funcName}`);
        if (slice.lines && slice.lines.length > 0) {
          results.push(`  Slice lines: ${slice.lines.length}`);
        }
        if (slice.variables && slice.variables.length > 0) {
          results.push(`  Variables: ${slice.variables.join(", ")}`);
        }
      }
    }
    return results.length > 4 ? results.join("\n") : null;
  } catch {
    return null;
  }
}
async function main() {
  const _perfStart = startTimer();
  const input = readHookInput();
  if (!isRelevantForIntent("tldr-read-enforcer")) {
    console.log("{}");
    return;
  }
  if (input.tool_name !== "Read") {
    console.log("{}");
    return;
  }
  const filePath = input.tool_input.file_path || "";
  if (!isCodeFile(filePath)) {
    console.log("{}");
    return;
  }
  if (isAllowedFile(filePath)) {
    console.log("{}");
    return;
  }
  if (input.tool_input.offset || input.tool_input.limit && input.tool_input.limit < 100) {
    console.log("{}");
    return;
  }
  try {
    const stats = statSync3(filePath);
    if (stats.size < 3e3) {
      console.log("{}");
      return;
    }
  } catch {
    console.log("{}");
    return;
  }
  const language = detectLanguage(filePath);
  let layers = ["ast", "call_graph"];
  let target = null;
  let contextSource = "default";
  const searchContext = getSearchContext(input.session_id, input.cwd || process.cwd());
  if (searchContext) {
    layers = searchContext.suggestedLayers;
    target = searchContext.target;
    contextSource = `${searchContext.targetType}: ${searchContext.target}`;
  }
  const tldrContext = getTldrContext(filePath, language, layers, target, input.session_id, contextSource);
  if (!tldrContext) {
    console.log("{}");
    return;
  }
  const layerNames = layers.map((l) => {
    switch (l) {
      case "ast":
        return "L1:AST";
      case "call_graph":
        return "L2:CallGraph";
      case "cfg":
        return "L3:CFG";
      case "dfg":
        return "L4:DFG";
      case "pdg":
        return "L5:PDG";
      default:
        return l;
    }
  }).join(" + ");
  let crossFileSection = "";
  if (searchContext?.callers && searchContext.callers.length > 0) {
    const callerLines = searchContext.callers.slice(0, 10).map((c) => {
      const parts = c.split("/");
      const fileAndLine = parts[parts.length - 1];
      const dir = parts.length > 2 ? parts[parts.length - 2] : "";
      return `  ${dir ? dir + "/" : ""}${fileAndLine}`;
    });
    crossFileSection = `
## Cross-File Usage (${searchContext.callers.length} refs)
${callerLines.join("\n")}${searchContext.callers.length > 10 ? `
  ... and ${searchContext.callers.length - 10} more` : ""}
`;
  }
  let definitionSection = "";
  if (searchContext?.definitionLocation && !searchContext.definitionLocation.includes(basename2(filePath))) {
    definitionSection = `
\u{1F4CD} Defined at: ${searchContext.definitionLocation}
`;
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  trackHookActivitySync("tldr-read-enforcer", projectDir, true, {
    reads_intercepted: 1,
    layers_returned: layers.length
  });
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Structured code context is provided below. Use Read with offset/limit for source lines.",
      additionalContext: `TLDR Context (${layerNames}):
${searchContext ? `\u{1F517} Context: ${contextSource}` : ""}${definitionSection}

${tldrContext}${crossFileSection}
---
To read specific lines, use: Read with offset/limit
To read full file anyway, use: Read ${basename2(filePath)} (test files bypass this)`
    }
  };
  endTimer(_perfStart, "tldr-read-enforcer", "PreToolUse");
  const bounded = budgetHookOutput(output, "tldr-read-enforcer", "PreToolUse:Read");
  console.log(JSON.stringify(bounded.hookSpecificOutput?.additionalContext ? bounded : {}));
}
main().catch((err) => {
  console.error(`TLDR enforcer error: ${err.message}`);
  console.log("{}");
});
