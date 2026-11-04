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

// src/smart-search-router.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync3, writeFileSync as writeFileSync4 } from "fs";
import { spawnSync as spawnSync2 } from "child_process";
import { join as join4, resolve as resolve3 } from "path";

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

// src/smart-search-router.ts
import { homedir as homedir3 } from "node:os";
import { createHash as createHash3 } from "node:crypto";
var CONTEXT_DIR = join4(homedir3(), ".claude", "cache", "search-context");
function storeSearchContext(sessionId, context, project) {
  try {
    if (!existsSync4(CONTEXT_DIR)) {
      mkdirSync3(CONTEXT_DIR, { recursive: true, mode: 448 });
    }
    const key = createHash3("sha256").update(JSON.stringify([resolve3(project), sessionId])).digest("hex");
    writeFileSync4(join4(CONTEXT_DIR, `${key}.json`), JSON.stringify(context), { mode: 384 });
  } catch {
  }
}
function tldrSearch(pattern, projectDir = ".") {
  try {
    const response = queryDaemonSync({ cmd: "search", pattern }, projectDir);
    if (response.indexing || response.status === "unavailable") {
      return ripgrepFallback(pattern, projectDir);
    }
    if (response.status === "ok" && response.results) {
      return response.results;
    }
    return [];
  } catch {
    return ripgrepFallback(pattern, projectDir);
  }
}
function ripgrepFallback(pattern, projectDir) {
  try {
    const rg = spawnSync2("rg", [pattern, projectDir, "--type", "py", "--line-number", "--max-count", "10"], {
      encoding: "utf-8",
      timeout: 3e3
    });
    const result = rg.stdout || "";
    return result.trim().split("\n").filter((l) => l).slice(0, 10).map((line) => {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        return { file: match[1], line: parseInt(match[2], 10), content: match[3] };
      }
      return { file: line, line: 0, content: "" };
    });
  } catch {
    return [];
  }
}
function checkSemanticIndexExists(projectDir) {
  const indexPath = join4(projectDir, ".tldr", "cache", "semantic", "index.faiss");
  return existsSync4(indexPath);
}
function tldrSemantic(query, projectDir = ".") {
  if (!checkSemanticIndexExists(projectDir)) {
    return { results: [], status: "no_index" };
  }
  try {
    const response = queryDaemonSync({ cmd: "semantic", query, k: 5 }, projectDir);
    if (response.indexing) {
      return { results: [], status: "indexing" };
    }
    if (response.status === "unavailable") {
      return { results: [], status: "daemon_unavailable" };
    }
    if (response.status === "ok" && response.results) {
      return { results: response.results, status: "ok" };
    }
    return { results: [], status: "ok" };
  } catch {
    return { results: [], status: "error" };
  }
}
function tldrImpact(funcName, projectDir = ".") {
  try {
    const response = queryDaemonSync({ cmd: "impact", func: funcName }, projectDir);
    if (response.indexing || response.status === "unavailable") {
      return [];
    }
    if (response.status === "ok" && response.callers) {
      return response.callers.map((c) => `${c.file}:${c.line}`);
    }
    return [];
  } catch {
    return [];
  }
}
function lookupCallers(pattern) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || ".";
  return tldrImpact(pattern, projectDir).slice(0, 20);
}
function lookupSymbol(pattern) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || ".";
  const funcResults = tldrSearch(`def ${pattern}`, projectDir);
  if (funcResults.length > 0) {
    return {
      type: "function",
      location: `${funcResults[0].file}:${funcResults[0].line}`
    };
  }
  const classResults = tldrSearch(`class ${pattern}`, projectDir);
  if (classResults.length > 0) {
    return {
      type: "class",
      location: `${classResults[0].file}:${classResults[0].line}`
    };
  }
  if (/^[A-Z][A-Z0-9_]+$/.test(pattern)) {
    const varResults = tldrSearch(`${pattern} =`, projectDir);
    if (varResults.length > 0) {
      return {
        type: "variable",
        location: `${varResults[0].file}:${varResults[0].line}`
      };
    }
  }
  return null;
}
var FUNCTION_VERB_PREFIXES = /^(get|set|is|has|do|can|create|update|delete|fetch|load|save|read|write|parse|build|make|init|setup|run|start|stop|handle|process|validate|check|find|search|filter|sort|map|reduce|transform|convert|format|render|display|show|hide|enable|disable|add|remove|insert|append|push|pop|clear|reset|close|open|connect|disconnect|send|receive|emit|on_|async_|_get|_set|_is|_has|_do|_create|_update|_delete|_fetch|_load|_save|_read|_write|_parse|_build|_make|_init|_setup|_run|_handle|_process|_validate|_check|_find|poll|call|exec|execute|invoke|apply|bind|dispatch|trigger|fire|notify|broadcast|publish|subscribe|unsubscribe|listen|watch|observe|register|unregister|mount|unmount|attach|detach|flush|dump|log|warn|error|debug|trace|print|throw|raise|assert|test|mock|stub|spy|wait|sleep|delay|retry|abort|cancel|pause|resume|refresh|reload|rerun|revert|rollback|commit|merge|split|join|clone|copy|move|swap|toggle|flip|increment|decrement|next|prev|first|last|peek|drain|consume|produce|yield|spawn|fork|join|kill|terminate|shutdown|cleanup|destroy|dispose|release|acquire|lock|unlock|enter|exit|begin|end|finalize)(_|$)/;
function extractTarget(pattern) {
  const indexed = lookupSymbol(pattern);
  if (indexed) {
    return { target: pattern, targetType: indexed.type };
  }
  const classMatch = pattern.match(/^class\s+(\w+)/);
  if (classMatch) return { target: classMatch[1], targetType: "class" };
  const defMatch = pattern.match(/^(?:async\s+)?def\s+(\w+)/);
  if (defMatch) return { target: defMatch[1], targetType: "function" };
  const functionMatch = pattern.match(/^(?:async\s+)?function\s+(\w+)/);
  if (functionMatch) return { target: functionMatch[1], targetType: "function" };
  const decoratorMatch = pattern.match(/^@(\w+)/);
  if (decoratorMatch) return { target: decoratorMatch[1], targetType: "decorator" };
  const importMatch = pattern.match(/^(?:import|from)\s+(\w+)/);
  if (importMatch) return { target: importMatch[1], targetType: "import" };
  const attrMatch = pattern.match(/(?:self|this)(?:\.|\\\.|\\\.\s*)(\w+)/);
  if (attrMatch) {
    const attr = attrMatch[1];
    if (FUNCTION_VERB_PREFIXES.test(attr)) {
      return { target: attr, targetType: "function" };
    }
    return { target: attr, targetType: "variable" };
  }
  if (/^__[a-z][a-z0-9_]*__$/.test(pattern)) {
    const moduleVars = ["__all__", "__version__", "__author__", "__doc__", "__file__", "__name__", "__package__", "__path__", "__cached__", "__loader__", "__spec__", "__builtins__", "__dict__", "__module__", "__slots__", "__annotations__"];
    if (moduleVars.includes(pattern)) {
      return { target: pattern, targetType: "variable" };
    }
    return { target: pattern, targetType: "function" };
  }
  if (/^[A-Z][A-Z0-9_]+$/.test(pattern)) return { target: pattern, targetType: "variable" };
  if (/^[A-Z][a-zA-Z0-9]+$/.test(pattern)) return { target: pattern, targetType: "class" };
  if (/^_?[a-z][a-z0-9_]*$/.test(pattern) && FUNCTION_VERB_PREFIXES.test(pattern)) {
    return { target: pattern, targetType: "function" };
  }
  if (/^_?[a-z][a-z0-9_]*$/.test(pattern)) {
    return { target: pattern, targetType: "variable" };
  }
  const camelCaseVerbPattern = /^(get|set|is|has|do|can|use|create|update|delete|fetch|load|save|read|write|parse|build|make|init|setup|run|start|stop|handle|process|validate|check|find|search|filter|sort|map|reduce|transform|convert|format|render|display|show|hide|enable|disable|add|remove|insert|append|push|pop|clear|reset|close|open|connect|disconnect|send|receive|emit|on|async|poll|call|exec|execute|invoke|apply|bind|dispatch|trigger|fire|notify|broadcast|publish|subscribe|watch|observe|register|mount|attach|flush|dump|log|warn|error|debug|print|throw|assert|test|mock|wait|sleep|retry|abort|cancel|pause|resume|refresh|reload|revert|commit|merge|clone|copy|move|toggle|spawn|fork|kill|terminate|shutdown|cleanup|destroy|dispose|release|acquire|lock|unlock|enter|exit|begin|end)[A-Z]/;
  if (camelCaseVerbPattern.test(pattern)) {
    return { target: pattern, targetType: "function" };
  }
  if (/^[a-z][a-zA-Z0-9]*$/.test(pattern) && /[A-Z]/.test(pattern)) {
    return { target: pattern, targetType: "variable" };
  }
  const identMatch = pattern.match(/\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b/);
  if (identMatch) return { target: identMatch[1], targetType: "unknown" };
  return { target: null, targetType: "unknown" };
}
function suggestLayers(targetType, queryType) {
  switch (targetType) {
    case "function":
      return ["ast", "call_graph", "cfg"];
    case "class":
      return ["ast", "call_graph"];
    case "variable":
      return ["ast", "dfg"];
    case "import":
      return ["ast"];
    case "decorator":
      return ["ast", "call_graph"];
    default:
      return queryType === "semantic" ? ["ast", "call_graph", "cfg"] : ["ast", "call_graph"];
  }
}
function emitSearchAdvice(output) {
  const bounded = budgetHookOutput(output, "smart-search-router", "PreToolUse:Grep");
  console.log(JSON.stringify(bounded.hookSpecificOutput?.additionalContext ? bounded : {}));
}
function classifyQuery(pattern) {
  const structuralPatterns = [
    /^(class|function|def|async def|const|let|var|interface|type|export)\s+\w+/,
    /^(import|from|require)\s/,
    /^\w+\s*\([^)]*\)/,
    // function calls
    /^async\s+(function|def)/,
    /\$\w+/,
    // AST-grep metavariables
    /^@\w+/
    // decorators
  ];
  if (structuralPatterns.some((p) => p.test(pattern))) {
    return "structural";
  }
  if (pattern.includes("\\") || pattern.includes("[") || /\([^)]*\|/.test(pattern)) {
    return "literal";
  }
  if (/^[A-Z][a-zA-Z0-9]*$/.test(pattern) || /^[a-z_][a-z0-9_]*$/.test(pattern) || /^[A-Z_][A-Z0-9_]*$/.test(pattern)) {
    return "literal";
  }
  if (pattern.includes("/") || /\.(ts|py|js|go|rs|md)/.test(pattern)) {
    return "literal";
  }
  const words = pattern.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 2 && !/^(how|what|where|why|when|find|show|list)/i.test(pattern)) {
    return "literal";
  }
  const semanticPatterns = [
    /^(how|what|where|why|when|which)\s/i,
    /\?$/,
    /^(find|show|list|get|explain)\s+(all|the|every|any)/i,
    /works?$/i,
    /^.*\s+(implementation|architecture|flow|pattern|logic|system)$/i
  ];
  if (semanticPatterns.some((p) => p.test(pattern))) {
    return "semantic";
  }
  if (words.length >= 3) {
    return "semantic";
  }
  return "literal";
}
function getAstGrepSuggestion(pattern, lang = "python") {
  const suggestions = {
    "function": `def $FUNC($$$):`,
    "async": `async def $FUNC($$$):`,
    "class": `class $NAME:`,
    "import": `import $MODULE`,
    "decorator": `@$DECORATOR`
  };
  for (const [keyword, astPattern] of Object.entries(suggestions)) {
    if (pattern.toLowerCase().includes(keyword)) {
      return astPattern;
    }
  }
  return `$PATTERN($$$)`;
}
async function main() {
  const _perfStart = startTimer();
  let input;
  try {
    input = readHookInput();
  } catch {
    console.log("{}");
    return;
  }
  if (!isRelevantForIntent("smart-search-router")) {
    console.log("{}");
    return;
  }
  if (input.tool_name !== "Grep") {
    console.log("{}");
    return;
  }
  if (!input.tool_input || typeof input.tool_input.pattern !== "string") {
    console.log("{}");
    return;
  }
  const pattern = input.tool_input.pattern;
  const queryType = classifyQuery(pattern);
  const sessionId = input.session_id || "default";
  const { target, targetType } = extractTarget(pattern);
  const layers = suggestLayers(targetType, queryType);
  const symbolInfo = target ? lookupSymbol(target) : null;
  const callers = target ? lookupCallers(target) : [];
  storeSearchContext(sessionId, {
    timestamp: Date.now(),
    queryType,
    pattern,
    target,
    targetType,
    suggestedLayers: layers,
    definitionLocation: symbolInfo?.location,
    callers: callers.slice(0, 20)
    // Limit to 20 callers for token efficiency
  }, input.cwd || process.cwd());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || ".";
  if (queryType === "literal") {
    trackHookActivitySync("smart-search-router", projectDir, true, {
      queries_routed: 1,
      literal_queries: 1
    });
    const reason2 = `\u{1F50D} Use TLDR search for code exploration when installed:

**Option 1 - TLDR Skill:**
/tldr-search ${pattern}

**Option 2 - Direct CLI:**
\`\`\`bash
tldr search "${pattern}" .
\`\`\`

**Option 3 - Read specific file (TLDR auto-enriches):**
Read the file containing "${pattern}" - the tldr-read-enforcer will return structured context.

TLDR finds location + provides call graph + docstrings in one call.`;
    const output2 = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: reason2
      }
    };
    endTimer(_perfStart, "smart-search-router", "PreToolUse");
    emitSearchAdvice(output2);
    return;
  }
  if (queryType === "structural") {
    trackHookActivitySync("smart-search-router", projectDir, true, {
      queries_routed: 1,
      structural_queries: 1
    });
    const astPattern = getAstGrepSuggestion(pattern);
    const reason2 = `\u{1F3AF} Structural query - Use AST-grep OR TLDR:

**Option 1 - AST-grep (pattern matching):**
ast-grep --pattern "${astPattern}" --lang python

**Option 2 - TLDR (richer context):**
/tldr-search ${target || pattern}

AST-grep: precise pattern match, file:line only
TLDR: finds + call graph + docstrings + complexity`;
    const output2 = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: reason2
      }
    };
    endTimer(_perfStart, "smart-search-router", "PreToolUse");
    emitSearchAdvice(output2);
    return;
  }
  trackHookActivitySync("smart-search-router", projectDir, true, {
    queries_routed: 1,
    semantic_queries: 1
  });
  const semanticSearch = tldrSemantic(pattern, projectDir);
  let reason;
  if (semanticSearch.status === "ok" && semanticSearch.results.length > 0) {
    const resultsStr = semanticSearch.results.map((r) => {
      const loc = `${r.file}:${r.function || "module"}`;
      const score = r.score ? ` (${(r.score * 100).toFixed(0)}%)` : "";
      return `  - ${loc}${score}`;
    }).join("\n");
    reason = `\u{1F9E0} **Semantic Search Results** (via TLDR daemon):

${resultsStr}

**Next steps:**
1. Read the most relevant file: \`Read ${semanticSearch.results[0].file}\`
2. For deeper analysis: \`/tldr-search ${target || pattern} --layer all\`

The results above are semantically similar to "${pattern}".`;
  } else if (semanticSearch.status === "no_index") {
    reason = `\u{1F9E0} **Semantic Search Not Set Up**

No semantic index found. To enable AI-powered code search:

\`\`\`bash
tldr semantic index . --lang all
\`\`\`

This creates embeddings for your codebase; duration depends on project size and environment.
After indexing, natural language queries like "${pattern}" will find relevant code.

**For now, use:**
- \`/tldr-search ${target || pattern}\` - structured search
- \`Task(subagent_type="Explore", prompt="${pattern}")\` - agent exploration`;
  } else if (semanticSearch.status === "daemon_unavailable") {
    reason = `\u{1F9E0} **TLDR Daemon Not Running**

Start the daemon for semantic search:
\`\`\`bash
tldr daemon start
\`\`\`

Then retry your query. The daemon provides fast, in-memory semantic search.

**For now, use:**
- \`/tldr-search ${target || pattern}\` - structured search (no daemon needed)`;
  } else if (semanticSearch.status === "indexing") {
    reason = `\u{1F9E0} **Semantic Index Building...**

The daemon is currently building the semantic index.
Retry in a moment, or use structured search for now:

\`/tldr-search ${target || pattern}\``;
  } else {
    reason = `\u{1F9E0} **No Semantic Matches**

No code semantically similar to "${pattern}" found in the index.

**Try:**
1. Rephrase the query with different keywords
2. Use structured search: \`/tldr-search ${target || pattern}\`
3. Explore with agent: \`Task(subagent_type="Explore", prompt="${pattern}")\``;
  }
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: reason
    }
  };
  endTimer(_perfStart, "smart-search-router", "PreToolUse");
  emitSearchAdvice(output);
}
main().catch(console.error);
