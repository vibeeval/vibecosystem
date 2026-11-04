// src/agent-memory-saver.ts
import { readFileSync as readFileSync3, writeFileSync, existsSync as existsSync2, mkdirSync, appendFileSync } from "fs";
import { join as join3 } from "path";

// src/shared/hook-input.ts
import { readFileSync } from "node:fs";

// src/shared/context-budget.ts
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
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

// src/shared/hook-response.ts
function responseText(value) {
  if (value === void 0 || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(responseText).filter(Boolean).join("\n");
  if (typeof value !== "object") return String(value);
  const object = value;
  if ("stdout" in object || "stderr" in object) {
    return [object.stdout, object.stderr].map(responseText).filter(Boolean).join("\n");
  }
  if ("text" in object) return responseText(object.text);
  if ("content" in object) return responseText(object.content);
  if ("file" in object) return responseText(object.file);
  if (object.type === "image" || object.type === "image_url") return "";
  return JSON.stringify(value);
}
function hookResponseText(input) {
  return responseText(input.tool_response !== void 0 ? input.tool_response : input.tool_output);
}

// src/shared/hook-input.ts
function readHookInput(raw = readFileSync(0, "utf-8")) {
  const input = JSON.parse(raw);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Hook input must be a JSON object");
  }
  configureContextBudget(input);
  return input;
}

// src/shared/agent-memory.ts
import { existsSync, readFileSync as readFileSync2 } from "node:fs";
import { join as join2, resolve as resolve2 } from "node:path";
import { homedir } from "node:os";
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
    join2(homedir(), ".claude", "agents", `${agentType}.md`)
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const frontmatter = readFileSync2(file, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const scope2 = frontmatter?.[1].match(/^memory:\s*['"]?(user|project|local)['"]?\s*$/m)?.[1];
      if (scope2) return scope2;
    } catch {
    }
  }
  return "user";
}
function getAgentMemoryDir(agentType, scope2, cwd) {
  const name = sanitizeAgentType(agentType);
  if (scope2 === "user") return join2(homedir(), ".claude", "agent-memory", name);
  return join2(agentProjectDir(cwd), ".claude", scope2 === "local" ? "agent-memory-local" : "agent-memory", name);
}

// src/agent-memory-saver.ts
var LEARNING_SIGNALS = [
  /\bfound\b.*\bbug\b/i,
  /\broot cause\b/i,
  /\bfixed\b.*\bissue\b/i,
  /\bpattern\b.*\bdetected\b/i,
  /\bsecurity\b.*\b(vuln|issue|risk)\b/i,
  /\bperformance\b.*\b(issue|bottleneck|slow)\b/i,
  /\barchitectur(e|al)\b.*\b(decision|change|pattern)\b/i,
  /\bVERDICT:\s*(FAIL|WARN)\b/i,
  /\bCRITICAL\b/i,
  /\bbreaking change\b/i,
  /\bdeprecated\b/i,
  /\bmigrat(e|ion)\b/i,
  /\berror.*handl/i,
  /\brace condition\b/i,
  /\bmemory leak\b/i
];
var SUCCESS_SIGNALS = [
  /\bVERDICT:\s*PASS\b/i,
  /\ball tests pass/i,
  /\bbuild succeed/i,
  /\bimplemented\b/i,
  /\brefactored\b/i
];
function ensureDir(dir) {
  if (!existsSync2(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function getTimestamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").substring(0, 19);
}
function hasLearningSignal(output) {
  return LEARNING_SIGNALS.some((pattern) => pattern.test(output));
}
function hasSuccessSignal(output) {
  return SUCCESS_SIGNALS.some((pattern) => pattern.test(output));
}
function extractKeyInfo(output, maxLen = 500) {
  const lines = output.split("\n");
  const keyLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/VERDICT|CRITICAL|WARN|FAIL|ERROR|FOUND|PATTERN|DECISION|BUG|FIX|ROOT CAUSE/i.test(trimmed) || trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("##")) {
      keyLines.push(trimmed);
    }
  }
  let result = keyLines.join("\n");
  if (result.length > maxLen) {
    result = result.substring(0, maxLen) + "...";
  }
  return result || output.substring(0, maxLen);
}
function main() {
  try {
    const input = readHookInput();
    if (input.tool_name !== "Agent") return;
    const agentType = input.tool_input?.subagent_type;
    const output = hookResponseText(input);
    const description = input.tool_input?.description || "";
    if (!agentType || !output || output.length < 50) return;
    const hasLearning = hasLearningSignal(output);
    const hasSuccess = hasSuccessSignal(output);
    if (!hasLearning && !hasSuccess) return;
    const scope2 = getAgentMemoryScope(agentType, input.cwd);
    const memoryDir = getAgentMemoryDir(agentType, scope2, input.cwd);
    ensureDir(memoryDir);
    const timestamp = getTimestamp();
    const keyInfo = extractKeyInfo(output);
    if (hasLearning || hasSuccess) {
      const journalPath = join3(memoryDir, "learnings.md");
      const entry = `
## ${timestamp} - ${description || "Agent task"}

${keyInfo}

---
`;
      appendFileSync(journalPath, entry, "utf-8");
      try {
        const content = readFileSync3(journalPath, "utf-8");
        if (content.length > 5e4) {
          const truncated = content.substring(content.length - 4e4);
          const firstNewline = truncated.indexOf("\n## ");
          writeFileSync(journalPath, firstNewline > 0 ? truncated.substring(firstNewline) : truncated, "utf-8");
        }
      } catch {
      }
    }
    const memoryMdPath = join3(memoryDir, "MEMORY.md");
    if (!existsSync2(memoryMdPath)) {
      const initialContent = `# ${agentType} Agent Memory

Bu dosya ${agentType} agent'inin kalici bellegidir. Otomatik guncellenir.

## Ogrenimler
- [learnings.md](learnings.md) - Tespit edilen sorunlar, patternler, kararlar
`;
      writeFileSync(memoryMdPath, initialContent, "utf-8");
    }
  } catch {
  }
}
main();
