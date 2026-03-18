// src/compiler-in-the-loop.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2, mkdirSync as mkdirSync2 } from "fs";
import { execSync } from "child_process";
import { join as join2 } from "path";
import { tmpdir } from "os";

// src/shared/hook-profiler.ts
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// src/shared/log-rotation.ts
import { statSync, readFileSync, writeFileSync, appendFileSync, renameSync, unlinkSync } from "fs";
function appendWithRotation(filePath, line, maxBytes = 2 * 1024 * 1024, keepLines = 5e3) {
  appendFileSync(filePath, line);
  try {
    const stats = statSync(filePath);
    if (stats.size > maxBytes) {
      const tmpPath = filePath + ".rotating";
      try {
        renameSync(filePath, tmpPath);
        const content = readFileSync(tmpPath, "utf-8");
        const lines = content.split("\n").filter((l) => l.length > 0);
        writeFileSync(filePath, lines.slice(-keepLines).join("\n") + "\n");
        unlinkSync(tmpPath);
      } catch {
      }
    }
  } catch {
  }
}

// src/shared/hook-profiler.ts
var PERF_LOG = join(homedir(), ".claude", "cache", "hook-perf.jsonl");
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
    const cacheDir = join(homedir(), ".claude", "cache");
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
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
var STATE_DIR = process.env.CLAUDE_PROJECT_DIR ? join2(process.env.CLAUDE_PROJECT_DIR, ".claude", "cache", "lean") : join2(tmpdir(), "claude-lean");
var STATE_FILE = join2(STATE_DIR, "compiler-state.json");
function readStdin() {
  return readFileSync2(0, "utf-8");
}
function ensureStateDir() {
  if (!existsSync2(STATE_DIR)) {
    mkdirSync2(STATE_DIR, { recursive: true });
  }
}
function saveState(state) {
  ensureStateDir();
  writeFileSync2(STATE_FILE, JSON.stringify(state, null, 2));
}
function runLeanCompiler(filePath, cwd) {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const elanBin = join2(home, ".elan", "bin");
  const pathWithElan = `${elanBin}:${process.env.PATH}`;
  try {
    const hasLakefile = existsSync2(join2(cwd, "lakefile.lean")) || existsSync2(join2(cwd, "lakefile.toml"));
    const cmd = hasLakefile ? `cd "${cwd}" && lake build 2>&1` : `lean "${filePath}" 2>&1`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 6e4,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: pathWithElan }
    });
    const sorries = [];
    const fileContent = existsSync2(filePath) ? readFileSync2(filePath, "utf-8") : "";
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
  if (!existsSync2(filePath)) return [];
  const content = readFileSync2(filePath, "utf-8");
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
  const input = JSON.parse(readStdin());
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
    const leanCode = existsSync2(filePath) ? readFileSync2(filePath, "utf-8") : "";
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
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `
\u26A0\uFE0F LEAN COMPILER ERRORS:

${result.output}
${goedelBlock}
APOLLO Pattern: Use 'sorry' to mark failing sub-lemmas, then fix each one.
`
      }
    }));
  } else if (sorries.length > 0) {
    endTimer(_perfStart, "compiler-in-the-loop", "PostToolUse");
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `
\u26A0\uFE0F LEAN PROOF INCOMPLETE - ${sorries.length} sorry placeholder(s):

${sorries.join("\n")}
${goedelBlock}
Fix each 'sorry' with a valid proof term or tactic.
`
      }
    }));
  } else {
    endTimer(_perfStart, "compiler-in-the-loop", "PostToolUse");
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "\u2713 Lean proof compiles successfully with no sorries!"
      }
    }));
  }
}
main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
