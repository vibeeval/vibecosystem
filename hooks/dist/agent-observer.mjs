// src/agent-observer.ts
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

// src/agent-observer.ts
function main() {
  let raw = "";
  try {
    raw = readFileSync2(0, "utf-8");
  } catch {
    return;
  }
  if (!raw) {
    console.log("{}");
    return;
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    console.log("{}");
    return;
  }
  const logDir = join(homedir(), ".claude");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, "agent-events.jsonl");
  const entry = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    session: input.session_id?.slice(0, 8) || "unknown",
    event: input.hook_event_name || "PreToolUse",
    tool: input.tool_name,
    detail: ""
  };
  if (input.tool_name === "Agent" || input.tool_name === "Task") {
    const ti = input.tool_input;
    entry.agent_type = ti.subagent_type || ti.type || "unknown";
    entry.detail = (ti.description || ti.prompt?.slice(0, 80) || "").trim();
  } else if (input.tool_name === "Bash") {
    const cmd = input.tool_input.command || "";
    entry.detail = cmd.slice(0, 120);
  } else if (input.tool_name === "Read" || input.tool_name === "Edit" || input.tool_name === "Write") {
    entry.detail = (input.tool_input.file_path || "").replace(/\\/g, "/");
  } else if (input.tool_name === "Grep" || input.tool_name === "Glob") {
    entry.detail = input.tool_input.pattern || "";
  } else {
    entry.detail = JSON.stringify(input.tool_input).slice(0, 100);
  }
  if (process.env.CLAUDE_AGENT_ID) {
    entry.agent_id = process.env.CLAUDE_AGENT_ID;
  }
  appendWithRotation(logPath, JSON.stringify(entry) + "\n");
  console.log("{}");
}
main();
