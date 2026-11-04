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

// src/compiler-in-the-loop.ts
import { readFileSync as readFileSync4, writeFileSync as writeFileSync3, existsSync as existsSync3, mkdirSync as mkdirSync3 } from "fs";
import { execSync, spawnSync } from "child_process";
import { join as join3 } from "path";
import { tmpdir } from "os";

// src/shared/hook-profiler.ts
import { mkdirSync as mkdirSync2, existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";

// src/shared/log-rotation.ts
import { statSync as statSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2, appendFileSync, renameSync as renameSync2, unlinkSync } from "fs";
function appendWithRotation(filePath, line, maxBytes = 2 * 1024 * 1024, keepLines = 5e3) {
  appendFileSync(filePath, line, { mode: 384 });
  try {
    const stats = statSync2(filePath);
    if (stats.size > maxBytes) {
      const tmpPath = filePath + ".rotating";
      try {
        renameSync2(filePath, tmpPath);
        const content = readFileSync3(tmpPath, "utf-8");
        const lines = content.split("\n").filter((l) => l.length > 0);
        writeFileSync2(filePath, lines.slice(-keepLines).join("\n") + "\n");
        unlinkSync(tmpPath);
      } catch {
      }
    }
  } catch {
  }
}

// src/shared/hook-profiler.ts
var PERF_LOG = join2(homedir2(), ".claude", "cache", "hook-perf.jsonl");
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
    const cacheDir = join2(homedir2(), ".claude", "cache");
    if (!existsSync2(cacheDir)) mkdirSync2(cacheDir, { recursive: true });
    appendWithRotation(PERF_LOG, JSON.stringify(entry) + "\n", MAX_LOG_SIZE, 3e3);
  } catch {
  }
}

// src/compiler-in-the-loop.ts
var LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234";
var LMSTUDIO_ENDPOINT = process.env.LMSTUDIO_ENDPOINT || `${LMSTUDIO_BASE_URL}/v1/completions`;
var GOEDEL_ENABLED = process.env.GOEDEL_ENABLED !== "false";
var lmStudioAvailable = null;
var lmStudioCheckedAt = 0;
var AVAILABILITY_CACHE_MS = 6e4;
var STATE_DIR = process.env.CLAUDE_PROJECT_DIR ? join3(process.env.CLAUDE_PROJECT_DIR, ".claude", "cache", "lean") : join3(tmpdir(), "claude-lean");
var STATE_FILE = join3(STATE_DIR, "compiler-state.json");
function ensureStateDir() {
  if (!existsSync3(STATE_DIR)) {
    mkdirSync3(STATE_DIR, { recursive: true });
  }
}
function saveState(state) {
  ensureStateDir();
  writeFileSync3(STATE_FILE, JSON.stringify(state, null, 2));
}
function runLeanCompiler(filePath, cwd) {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const elanBin = join3(home, ".elan", "bin");
  const pathWithElan = `${elanBin}:${process.env.PATH}`;
  try {
    const hasLakefile = existsSync3(join3(cwd, "lakefile.lean")) || existsSync3(join3(cwd, "lakefile.toml"));
    let output;
    if (hasLakefile) {
      output = execSync("lake build 2>&1", {
        encoding: "utf-8",
        timeout: 6e4,
        maxBuffer: 1024 * 1024,
        cwd,
        env: { ...process.env, PATH: pathWithElan }
      });
    } else {
      const result = spawnSync("lean", [filePath], {
        encoding: "utf-8",
        timeout: 6e4,
        maxBuffer: 1024 * 1024,
        cwd,
        env: { ...process.env, PATH: pathWithElan }
      });
      output = (result.stdout || "") + (result.stderr || "");
    }
    const sorries = [];
    const fileContent = existsSync3(filePath) ? readFileSync4(filePath, "utf-8") : "";
    const sorryMatches = fileContent.match(/sorry/g);
    if (sorryMatches) {
      const lines = fileContent.split("\n");
      lines.forEach((line, i) => {
        if (line.includes("sorry")) {
          sorries.push(`Line ${i + 1}: ${line.trim()}`);
        }
      });
    }
    return { success: true, output, sorries };
  } catch (error) {
    const output = error.stdout || error.stderr || error.message;
    return { success: false, output, sorries: [] };
  }
}
function extractSorries(filePath) {
  if (!existsSync3(filePath)) return [];
  const content = readFileSync4(filePath, "utf-8");
  const sorries = [];
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (line.includes("sorry")) {
      sorries.push(`Line ${i + 1}: ${line.trim()}`);
    }
  });
  return sorries;
}
async function checkLMStudioAvailable() {
  const now = Date.now();
  if (lmStudioAvailable !== null && now - lmStudioCheckedAt < AVAILABILITY_CACHE_MS) {
    return lmStudioAvailable;
  }
  try {
    const response = await fetch(`${LMSTUDIO_BASE_URL}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(2e3)
      // 2s timeout - fail fast
    });
    lmStudioAvailable = response.ok;
    lmStudioCheckedAt = now;
    return lmStudioAvailable;
  } catch (err) {
    lmStudioAvailable = false;
    lmStudioCheckedAt = now;
    return false;
  }
}
function getLMStudioUnavailableMessage() {
  return `
\u2139\uFE0F Godel-Prover not available (LMStudio not running at ${LMSTUDIO_BASE_URL})
Lean compiler feedback only. To enable AI tactic suggestions:
1. Start LMStudio
2. Load goedel-prover-v2-8b model
`;
}
async function getGoedelSuggestions(leanCode, errors, sorries) {
  if (!GOEDEL_ENABLED) {
    return { suggestion: null, unavailableMessage: null };
  }
  const isAvailable = await checkLMStudioAvailable();
  if (!isAvailable) {
    return { suggestion: null, unavailableMessage: getLMStudioUnavailableMessage() };
  }
  try {
    const prompt = buildGoedelPrompt(leanCode, errors, sorries);
    const response = await fetch(LMSTUDIO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        max_tokens: 4096,
        temperature: 0.6,
        stop: ["```", "\n\n\n"]
      }),
      signal: AbortSignal.timeout(3e4)
      // 30s timeout for actual inference
    });
    if (!response.ok) {
      return { suggestion: null, unavailableMessage: null };
    }
    const data = await response.json();
    const suggestion = data.choices?.[0]?.text?.trim();
    if (!suggestion) {
      return { suggestion: null, unavailableMessage: null };
    }
    return { suggestion, unavailableMessage: null };
  } catch (err) {
    return { suggestion: null, unavailableMessage: null };
  }
}
function buildGoedelPrompt(leanCode, errors, sorries) {
  if (sorries.length > 0) {
    return `Complete the following Lean 4 code:

\`\`\`lean4
${leanCode}
\`\`\`

The proof has ${sorries.length} incomplete part(s):
${sorries.join("\n")}

Before producing the Lean 4 tactics to formally prove the given theorem, provide a detailed proof plan outlining the main proof steps and strategies.
The plan should highlight key ideas, intermediate lemmas, and proof structures that will guide the construction of the final formal proof.

## Proof Plan
1. What is the goal?
2. What key lemmas or intermediate steps are needed?
3. What tactics will achieve each step?

## Tactics
Provide the tactic(s) to replace the first sorry. Use tactics like: simp, ring, nlinarith, norm_num, exact, apply, rfl, ext, aesop_cat.

Response:`;
  } else {
    return `Fix the following Lean 4 code that has compiler errors:

\`\`\`lean4
${leanCode}
\`\`\`

Compiler errors:
${errors.slice(0, 1500)}

Provide ONLY the corrected Lean 4 code or the specific fix needed.

Fix:`;
  }
}
async function main() {
  const _perfStart = startTimer();
  const input = readHookInput();
  if (input.tool_name !== "Write") {
    console.log("{}");
    return;
  }
  const filePath = input.tool_input?.file_path || input.tool_response?.filePath || "";
  if (!filePath.endsWith(".lean")) {
    console.log("{}");
    return;
  }
  const result = runLeanCompiler(filePath, input.cwd);
  const sorries = extractSorries(filePath);
  const state = {
    session_id: input.session_id,
    file_path: filePath,
    has_errors: !result.success || sorries.length > 0,
    errors: result.output,
    sorries,
    timestamp: Date.now()
  };
  saveState(state);
  let goedelResult = { suggestion: null, unavailableMessage: null };
  if (!result.success || sorries.length > 0) {
    const leanCode = existsSync3(filePath) ? readFileSync4(filePath, "utf-8") : "";
    goedelResult = await getGoedelSuggestions(leanCode, result.output, sorries);
  }
  let goedelBlock = "";
  if (goedelResult.suggestion) {
    goedelBlock = `
\u{1F916} GOEDEL-PROVER SUGGESTION:

${goedelResult.suggestion}
`;
  } else if (goedelResult.unavailableMessage) {
    goedelBlock = goedelResult.unavailableMessage;
  }
  if (!result.success) {
    endTimer(_perfStart, "compiler-in-the-loop", "PostToolUse");
    console.log(JSON.stringify(budgetHookOutput({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `
\u26A0\uFE0F LEAN COMPILER ERRORS:

${result.output}
${goedelBlock}
APOLLO Pattern: Use 'sorry' to mark failing sub-lemmas, then fix each one.
`
      }
    }, "compiler-in-the-loop", "PostToolUse:Edit|Write")));
  } else if (sorries.length > 0) {
    endTimer(_perfStart, "compiler-in-the-loop", "PostToolUse");
    console.log(JSON.stringify(budgetHookOutput({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `
\u26A0\uFE0F LEAN PROOF INCOMPLETE - ${sorries.length} sorry placeholder(s):

${sorries.join("\n")}
${goedelBlock}
Fix each 'sorry' with a valid proof term or tactic.
`
      }
    }, "compiler-in-the-loop", "PostToolUse:Edit|Write")));
  } else {
    endTimer(_perfStart, "compiler-in-the-loop", "PostToolUse");
    console.log(JSON.stringify(budgetHookOutput({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "\u2713 Lean proof compiles successfully with no sorries!"
      }
    }, "compiler-in-the-loop", "PostToolUse:Edit|Write")));
  }
}
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
