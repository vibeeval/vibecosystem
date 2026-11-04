// src/agent-memory-saver.ts
import { appendFileSync, constants as constants2, fstatSync as fstatSync2, ftruncateSync, readSync, writeFileSync as writeFileSync2 } from "node:fs";

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
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync as readFileSync2, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { join as join2, resolve as resolve2 } from "node:path";
import { homedir } from "node:os";
function sanitizeAgentType(agentType) {
  return agentType.replace(/[:/\\\s]+/g, "-").replace(/[^a-zA-Z0-9_.-]/g, "").replace(/^\.+|\.+$/g, "").toLowerCase() || "unknown";
}
function agentProjectDir(cwd) {
  return resolve2(cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}
function safeDirectory(anchor, parts, create = false) {
  try {
    const root = realpathSync(anchor);
    if (!lstatSync(root).isDirectory()) return;
    let path = root;
    for (const part of parts) {
      if (!part || part === "." || part === ".." || /[/\\]/.test(part)) return;
      path = join2(path, part);
      try {
        if (create) mkdirSync(path, { mode: 448 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return;
    }
    if (realpathSync(path) !== path) return;
    return { path, anchor: root, parts };
  } catch {
    return;
  }
}
function getSafeAgentMemoryDir(agentType, scope2, cwd, create = false) {
  const anchor = scope2 === "user" ? homedir() : agentProjectDir(cwd);
  return safeDirectory(anchor, [".claude", scope2 === "local" ? "agent-memory-local" : "agent-memory", sanitizeAgentType(agentType)], create);
}
function isSafeAgentMemoryDir(dir) {
  return safeDirectory(dir.anchor, dir.parts)?.path === dir.path;
}
function withAgentMemoryFile(dir, name, flags, use) {
  let fd;
  try {
    if (!name || name === "." || name === ".." || /[/\\]/.test(name) || !isSafeAgentMemoryDir(dir)) return false;
    if (typeof constants.O_NOFOLLOW !== "number") return false;
    const path = join2(dir.path, name);
    fd = openSync(path, flags | constants.O_NOFOLLOW | constants.O_NONBLOCK, 384);
    const opened = fstatSync(fd);
    if (!opened.isFile() || !isSafeAgentMemoryDir(dir)) return false;
    const current = lstatSync(path);
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== opened.dev || current.ino !== opened.ino) return false;
    use(fd);
    return true;
  } catch {
    return false;
  } finally {
    if (fd !== void 0) closeSync(fd);
  }
}
function withAgentMemoryLock(dir, use) {
  const name = ".learnings.lock";
  const deadline = Date.now() + 1500;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  do {
    let acquired = false;
    const success = withAgentMemoryFile(dir, name, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, (fd) => {
      acquired = true;
      const lock = fstatSync(fd);
      try {
        writeFileSync(fd, JSON.stringify({ pid: process.pid }), "utf-8");
        use();
      } finally {
        if (isSafeAgentMemoryDir(dir)) {
          const current = lstatSync(join2(dir.path, name));
          if (current.isFile() && current.dev === lock.dev && current.ino === lock.ino) unlinkSync(join2(dir.path, name));
        }
      }
    });
    if (acquired) return success;
    if (!isSafeAgentMemoryDir(dir)) return false;
    try {
      const current = lstatSync(join2(dir.path, name));
      if (!current.isFile() || current.isSymbolicLink()) return false;
    } catch (error) {
      if (error.code !== "ENOENT") return false;
    }
    Atomics.wait(pause, 0, 0, 10);
  } while (Date.now() < deadline);
  return false;
}
function getAgentMemoryScope(agentType, cwd) {
  if (!/^[a-zA-Z0-9_:-]+$/.test(agentType)) return "user";
  for (const anchor of [agentProjectDir(cwd), homedir()]) {
    const dir = safeDirectory(anchor, [".claude", "agents"]);
    if (!dir) continue;
    let scope2;
    withAgentMemoryFile(dir, `${agentType}.md`, constants.O_RDONLY, (fd) => {
      if (fstatSync(fd).size > 1e5) return;
      const frontmatter = readFileSync2(fd, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
      scope2 = frontmatter?.[1].match(/^memory:\s*['"]?(user|project|local)['"]?\s*$/m)?.[1];
    });
    if (scope2) return scope2;
  }
  return "user";
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
    const memoryDir = getSafeAgentMemoryDir(agentType, scope2, input.cwd, true);
    if (!memoryDir) return;
    const timestamp = getTimestamp();
    const keyInfo = extractKeyInfo(output);
    const locked = withAgentMemoryLock(memoryDir, () => {
      const entry = `
## ${timestamp} - ${description || "Agent task"}

${keyInfo}

---
`;
      const saved = withAgentMemoryFile(memoryDir, "learnings.md", constants2.O_RDWR | constants2.O_CREAT | constants2.O_APPEND, (fd) => {
        appendFileSync(fd, entry, "utf-8");
        const size = fstatSync2(fd).size;
        if (size <= 5e4) return;
        const bytes = Buffer.alloc(size);
        let offset = 0;
        while (offset < size) {
          const count = readSync(fd, bytes, offset, size - offset, offset);
          if (count === 0) break;
          offset += count;
        }
        const content = bytes.subarray(0, offset).toString("utf-8");
        if (content.length <= 5e4) return;
        const truncated = content.substring(content.length - 4e4);
        const firstNewline = truncated.indexOf("\n## ");
        const next = firstNewline > 0 ? truncated.substring(firstNewline) : truncated;
        ftruncateSync(fd, 0);
        writeFileSync2(fd, next, "utf-8");
      });
      if (!saved) return;
      const initialContent = `# ${agentType} Agent Memory

Bu dosya ${agentType} agent'inin kalici bellegidir. Otomatik guncellenir.

## Ogrenimler
- [learnings.md](learnings.md) - Tespit edilen sorunlar, patternler, kararlar
`;
      withAgentMemoryFile(memoryDir, "MEMORY.md", constants2.O_WRONLY | constants2.O_CREAT | constants2.O_EXCL, (fd) => {
        writeFileSync2(fd, initialContent, "utf-8");
      });
    });
    if (!locked) process.stderr.write("[agent-memory] Optional save skipped: journal lock busy or unsafe. Review .learnings.lock after all writers stop; remove only an abandoned lock.\n");
  } catch {
  }
}
main();
