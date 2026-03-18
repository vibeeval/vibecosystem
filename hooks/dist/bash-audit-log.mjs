// src/bash-audit-log.ts
import { readFileSync as readFileSync2, mkdirSync, existsSync } from "fs";
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

// src/bash-audit-log.ts
var WRITE_PATTERNS = [
  /^(rm|mv|cp|mkdir|rmdir|touch|chmod|chown)\b/,
  /^git\s+(push|commit|reset|checkout|merge|rebase|stash|clean|branch\s+-[dD])/,
  /\b(npm|pnpm|yarn)\s+(install|uninstall|publish|run\s+build)/,
  />(>)?/,
  // redirect
  /\bsudo\b/,
  /\bdocker\s+(rm|stop|kill|exec|run)/
];
function isWriteCommand(cmd) {
  return WRITE_PATTERNS.some((p) => p.test(cmd.trim()));
}
function main() {
  let raw = "";
  try {
    raw = readFileSync2(0, "utf-8");
  } catch {
    return;
  }
  if (!raw) return;
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    console.log("{}");
    return;
  }
  if (input.tool_name !== "Bash" || !input.tool_input?.command) {
    console.log("{}");
    return;
  }
  const cmd = input.tool_input.command;
  const tag = isWriteCommand(cmd) ? "[WRITE]" : "[READ]";
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const desc = input.tool_input.description || "";
  const sessionId = input.session_id?.slice(0, 8) || "unknown";
  const logDir = join(homedir(), ".claude");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logLine = `${timestamp} ${tag} [${sessionId}] ${cmd}${desc ? ` # ${desc}` : ""}
`;
  appendWithRotation(join(logDir, "bash-audit.log"), logLine);
  console.log("{}");
}
main();
