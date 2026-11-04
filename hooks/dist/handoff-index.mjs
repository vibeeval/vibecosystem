// src/handoff-index.ts
import * as fs from "fs";
import * as path from "path";
import { spawn, execSync } from "child_process";

// src/shared/optional-sqlite.ts
import { createRequire } from "node:module";
function reportSqliteUnavailable(hook) {
  console.error(`[${hook}] SQLite operation skipped: optional better-sqlite3 is missing or incompatible. Install a Node-compatible version in the hooks directory (for a managed install: ~/.claude/hooks), or use the core profile.`);
}
function loadOptionalSqlite(hook) {
  try {
    return createRequire(import.meta.url)("better-sqlite3");
  } catch {
    reportSqliteUnavailable(hook);
    return null;
  }
}

// src/handoff-index.ts
function getPpid(pid) {
  if (!Number.isInteger(pid) || pid < 1) return null;
  if (process.platform === "win32") {
    try {
      const result = execSync(`wmic process where ProcessId=${pid} get ParentProcessId`, {
        encoding: "utf-8",
        timeout: 5e3
      });
      for (const line of result.split("\n")) {
        const trimmed = line.trim();
        if (/^\d+$/.test(trimmed)) {
          return parseInt(trimmed, 10);
        }
      }
    } catch {
    }
    return null;
  }
  try {
    const result = execSync(`ps -o ppid= -p ${pid}`, {
      encoding: "utf-8",
      timeout: 5e3
    });
    const ppid = parseInt(result.trim(), 10);
    return isNaN(ppid) ? null : ppid;
  } catch {
    return null;
  }
}
function getTerminalShellPid() {
  try {
    const parent = process.ppid;
    if (!parent) return null;
    const grandparent = getPpid(parent);
    if (!grandparent) return null;
    return getPpid(grandparent);
  } catch {
    return null;
  }
}
function storeSessionAffinity(projectDir, terminalPid, sessionName) {
  const dbPath = path.join(projectDir, ".claude", "cache", "artifact-index", "context.db");
  const dbDir = path.dirname(dbPath);
  const Sqlite = loadOptionalSqlite("handoff-index");
  if (!Sqlite) return;
  let db;
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Sqlite(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS instance_sessions (
        terminal_pid TEXT PRIMARY KEY,
        session_name TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO instance_sessions (terminal_pid, session_name, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run(terminalPid.toString(), sessionName);
  } catch {
    reportSqliteUnavailable("handoff-index");
  } finally {
    try {
      db?.close();
    } catch {
    }
  }
}
function extractSessionName(filePath) {
  const parts = filePath.split("/");
  const handoffsIdx = parts.findIndex((p) => p === "handoffs");
  if (handoffsIdx >= 0 && handoffsIdx < parts.length - 1) {
    return parts[handoffsIdx + 1];
  }
  return null;
}
async function main() {
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (input.tool_name !== "Write") {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const filePath = input.tool_input?.file_path || "";
  const isHandoffFile = filePath.endsWith(".md") || filePath.endsWith(".yaml") || filePath.endsWith(".yml");
  if (!filePath.includes("handoffs") || !isHandoffFile) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(JSON.stringify({ result: "continue" }));
      return;
    }
    let content = fs.readFileSync(fullPath, "utf-8");
    let modified = false;
    const isYamlFile = fullPath.endsWith(".yaml") || fullPath.endsWith(".yml");
    const hasFrontmatter = content.startsWith("---");
    const hasRootSpanId = content.includes("root_span_id:");
    if (!hasRootSpanId) {
      const stateFile = path.join(homeDir, ".claude", "state", "braintrust_sessions", `${input.session_id}.json`);
      if (fs.existsSync(stateFile)) {
        try {
          const stateContent = fs.readFileSync(stateFile, "utf-8");
          const state = JSON.parse(stateContent);
          const newFields = [
            `root_span_id: ${state.root_span_id}`,
            `turn_span_id: ${state.current_turn_span_id || ""}`,
            `session_id: ${input.session_id}`
          ].join("\n");
          if (isYamlFile) {
            content = `${newFields}
${content}`;
          } else if (hasFrontmatter) {
            content = content.replace(/^---\n/, `---
${newFields}
`);
          } else {
            content = `---
${newFields}
---

${content}`;
          }
          const tempPath = fullPath + ".tmp";
          fs.writeFileSync(tempPath, content);
          fs.renameSync(tempPath, fullPath);
          modified = true;
        } catch (stateErr) {
        }
      }
    }
    const terminalPid = getTerminalShellPid();
    const sessionName = extractSessionName(fullPath);
    if (terminalPid && sessionName) {
      storeSessionAffinity(projectDir, terminalPid, sessionName);
    }
    const indexScript = path.join(projectDir, "scripts", "artifact_index.py");
    if (fs.existsSync(indexScript)) {
      const child = spawn("uv", ["run", "python", indexScript, "--file", fullPath], {
        cwd: projectDir,
        detached: true,
        stdio: "ignore"
      });
      child.on("error", () => {
        console.error("[handoff-index] Artifact indexing skipped: uv could not start.");
      });
      child.unref();
    }
    console.log(JSON.stringify({ result: "continue" }));
  } catch (err) {
    console.log(JSON.stringify({ result: "continue" }));
  }
}
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
main().catch(console.error);
