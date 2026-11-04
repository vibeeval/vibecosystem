// src/pre-compact-continuity.ts
import * as fs2 from "fs";
import * as path from "path";
import { homedir as homedir2 } from "os";

// src/shared/transcript-parser.ts
import * as fs from "fs";
function parseTranscript(transcriptPath) {
  const summary = {
    lastTodos: [],
    recentToolCalls: [],
    lastAssistantMessage: "",
    filesModified: [],
    errorsEncountered: []
  };
  if (!fs.existsSync(transcriptPath)) {
    return summary;
  }
  const content = fs.readFileSync(transcriptPath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  const allToolCalls = [];
  const modifiedFiles = /* @__PURE__ */ new Set();
  const errors = [];
  let lastTodoState = [];
  let lastAssistant = "";
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.role === "assistant" && typeof entry.content === "string") {
        lastAssistant = entry.content;
      } else if (entry.type === "assistant" && typeof entry.content === "string") {
        lastAssistant = entry.content;
      }
      if (entry.tool_name || entry.type === "tool_use") {
        const toolName = entry.tool_name || entry.name;
        if (toolName) {
          const toolCall = {
            name: toolName,
            timestamp: entry.timestamp,
            input: entry.tool_input,
            success: true
            // Will be updated by result
          };
          if (toolName === "TodoWrite" || toolName.toLowerCase().includes("todowrite")) {
            const input = entry.tool_input;
            if (input?.todos) {
              lastTodoState = input.todos.map((t, idx) => ({
                id: t.id || `todo-${idx}`,
                content: t.content || "",
                status: t.status || "pending"
              }));
            }
          }
          if (toolName === "Edit" || toolName === "Write" || toolName.toLowerCase().includes("edit") || toolName.toLowerCase().includes("write")) {
            const input = entry.tool_input;
            const filePath = input?.file_path || input?.path;
            if (filePath && typeof filePath === "string") {
              modifiedFiles.add(filePath);
            }
          }
          if (toolName === "Bash" || toolName.toLowerCase().includes("bash")) {
            const input = entry.tool_input;
            if (input?.command) {
              toolCall.input = { command: input.command };
            }
          }
          allToolCalls.push(toolCall);
        }
      }
      if (entry.type === "tool_result" || entry.tool_result !== void 0) {
        const result = entry.tool_result;
        if (result) {
          const exitCode = result.exit_code ?? result.exitCode;
          if (exitCode !== void 0 && exitCode !== 0) {
            if (allToolCalls.length > 0) {
              allToolCalls[allToolCalls.length - 1].success = false;
            }
            const errorMsg = result.stderr || result.error || "Command failed";
            const lastTool = allToolCalls[allToolCalls.length - 1];
            const command = lastTool?.input?.command || "unknown command";
            errors.push(`${command}: ${errorMsg.substring(0, 200)}`);
          }
        }
        if (entry.error) {
          errors.push(entry.error.substring(0, 200));
          if (allToolCalls.length > 0) {
            allToolCalls[allToolCalls.length - 1].success = false;
          }
        }
      }
    } catch {
      continue;
    }
  }
  summary.lastTodos = lastTodoState;
  summary.recentToolCalls = allToolCalls.slice(-5);
  summary.lastAssistantMessage = lastAssistant.substring(0, 500);
  summary.filesModified = Array.from(modifiedFiles);
  summary.errorsEncountered = errors.slice(-5);
  return summary;
}
function generateAutoHandoff(summary, sessionName) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const dateOnly = timestamp.split("T")[0];
  const lines = [];
  const inProgress = summary.lastTodos.filter((t) => t.status === "in_progress");
  const pending = summary.lastTodos.filter((t) => t.status === "pending");
  const completed = summary.lastTodos.filter((t) => t.status === "completed");
  const currentTask = inProgress[0]?.content || pending[0]?.content || "Continue from auto-compact";
  const goalSummary = completed.length > 0 ? `Completed ${completed.length} task(s) before auto-compact` : "Session auto-compacted";
  lines.push("---");
  lines.push(`session: ${sessionName}`);
  lines.push(`date: ${dateOnly}`);
  lines.push("status: partial");
  lines.push("outcome: PARTIAL_PLUS");
  lines.push("---");
  lines.push("");
  lines.push(`goal: ${goalSummary}`);
  lines.push(`now: ${currentTask}`);
  lines.push("test: # No test command captured");
  lines.push("");
  lines.push("done_this_session:");
  if (completed.length > 0) {
    completed.forEach((t) => {
      lines.push(`  - task: "${t.content.replace(/"/g, '\\"')}"`);
      lines.push("    files: []");
    });
  } else {
    lines.push('  - task: "Session started"');
    lines.push("    files: []");
  }
  lines.push("");
  lines.push("blockers:");
  if (summary.errorsEncountered.length > 0) {
    summary.errorsEncountered.slice(0, 3).forEach((e) => {
      const safeError = e.replace(/"/g, '\\"').substring(0, 100);
      lines.push(`  - "${safeError}"`);
    });
  } else {
    lines.push("  []");
  }
  lines.push("");
  lines.push("questions:");
  if (pending.length > 0) {
    pending.slice(0, 3).forEach((t) => {
      lines.push(`  - "Resume: ${t.content.replace(/"/g, '\\"')}"`);
    });
  } else {
    lines.push("  []");
  }
  lines.push("");
  lines.push("decisions:");
  lines.push('  - auto_compact: "Context limit reached, auto-compacted"');
  lines.push("");
  lines.push("findings:");
  lines.push(`  - tool_calls: "${summary.recentToolCalls.length} recent tool calls"`);
  lines.push(`  - files_modified: "${summary.filesModified.length} files changed"`);
  lines.push("");
  lines.push("worked:");
  const successfulTools = summary.recentToolCalls.filter((t) => t.success);
  if (successfulTools.length > 0) {
    lines.push(`  - "${successfulTools.map((t) => t.name).join(", ")} completed successfully"`);
  } else {
    lines.push("  []");
  }
  lines.push("");
  lines.push("failed:");
  const failedTools = summary.recentToolCalls.filter((t) => !t.success);
  if (failedTools.length > 0) {
    lines.push(`  - "${failedTools.map((t) => t.name).join(", ")} encountered errors"`);
  } else {
    lines.push("  []");
  }
  lines.push("");
  lines.push("next:");
  if (inProgress.length > 0) {
    lines.push(`  - "Continue: ${inProgress[0].content.replace(/"/g, '\\"')}"`);
  }
  if (pending.length > 0) {
    pending.slice(0, 2).forEach((t) => {
      lines.push(`  - "${t.content.replace(/"/g, '\\"')}"`);
    });
  }
  if (inProgress.length === 0 && pending.length === 0) {
    lines.push('  - "Review session state and continue"');
  }
  lines.push("");
  lines.push("files:");
  lines.push("  created: []");
  lines.push("  modified:");
  if (summary.filesModified.length > 0) {
    summary.filesModified.slice(0, 10).forEach((f) => {
      lines.push(`    - "${f}"`);
    });
  } else {
    lines.push("    []");
  }
  return lines.join("\n");
}

// src/shared/hook-profiler.ts
import { mkdirSync, existsSync as existsSync2 } from "fs";
import { join } from "path";
import { homedir } from "os";

// src/shared/log-rotation.ts
import { statSync, readFileSync as readFileSync2, writeFileSync, appendFileSync, renameSync, unlinkSync } from "fs";
function appendWithRotation(filePath, line, maxBytes = 2 * 1024 * 1024, keepLines = 5e3) {
  appendFileSync(filePath, line, { mode: 384 });
  try {
    const stats = statSync(filePath);
    if (stats.size > maxBytes) {
      const tmpPath = filePath + ".rotating";
      try {
        renameSync(filePath, tmpPath);
        const content = readFileSync2(tmpPath, "utf-8");
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
    if (!existsSync2(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    appendWithRotation(PERF_LOG, JSON.stringify(entry) + "\n", MAX_LOG_SIZE, 3e3);
  } catch {
  }
}

// src/shared/precompact-paths.ts
import { closeSync, constants, fstatSync, lstatSync, mkdirSync as mkdirSync2, openSync, realpathSync } from "node:fs";
import { join as join2 } from "node:path";
function continuityDirectory(project, parts, create = false) {
  try {
    const anchor = realpathSync(project);
    if (!lstatSync(anchor).isDirectory()) return;
    let path2 = anchor;
    for (const part of parts) {
      if (!part || part === "." || part === ".." || /[/\\]/.test(part)) return;
      path2 = join2(path2, part);
      if (create) {
        try {
          mkdirSync2(path2, { mode: 448 });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
      const stat = lstatSync(path2);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return;
    }
    if (realpathSync(path2) !== path2) return;
    return { path: path2, anchor, parts };
  } catch {
    return;
  }
}
function isContinuityDirectory(dir) {
  return continuityDirectory(dir.anchor, dir.parts)?.path === dir.path;
}
function withContinuityFile(dir, name, flags, use) {
  let fd;
  try {
    if (!name || name === "." || name === ".." || /[/\\]/.test(name) || !isContinuityDirectory(dir)) return;
    if (typeof constants.O_NOFOLLOW !== "number" || flags & constants.O_TRUNC) return;
    fd = openSync(join2(dir.path, name), flags | constants.O_NOFOLLOW | constants.O_NONBLOCK, 384);
    const opened = fstatSync(fd);
    if (!opened.isFile() || !isContinuityDirectory(dir)) return;
    const current = lstatSync(join2(dir.path, name));
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== opened.dev || current.ino !== opened.ino) return;
    return use(fd);
  } catch {
    return;
  } finally {
    if (fd !== void 0) closeSync(fd);
  }
}

// src/pre-compact-continuity.ts
async function main() {
  const _perfStart = startTimer();
  const input = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const ledgerDir = continuityDirectory(projectDir, ["thoughts", "ledgers"]);
  if (!ledgerDir) {
    const output = {
      continue: true,
      systemMessage: "[PreCompact] No ledger directory found."
    };
    endTimer(_perfStart, "pre-compact-continuity", "PreCompact");
    console.log(JSON.stringify(output));
    return;
  }
  const ledgerFiles = fs2.readdirSync(ledgerDir.path).filter((name) => name.startsWith("CONTINUITY_CLAUDE-") && name.endsWith(".md")).flatMap((name) => {
    const mtime = withContinuityFile(ledgerDir, name, fs2.constants.O_RDONLY, (fd) => fs2.fstatSync(fd).mtimeMs);
    return mtime === void 0 ? [] : [{ name, mtime }];
  });
  if (ledgerFiles.length === 0) {
    const output = {
      continue: true,
      systemMessage: "[PreCompact] No ledger found. Save a brief task summary before compacting."
    };
    endTimer(_perfStart, "pre-compact-continuity", "PreCompact");
    console.log(JSON.stringify(output));
    return;
  }
  const mostRecent = ledgerFiles.sort((a, b) => b.mtime - a.mtime)[0].name;
  if (input.trigger === "auto") {
    const sessionName = mostRecent.replace("CONTINUITY_CLAUDE-", "").replace(".md", "");
    let handoffFile = "";
    if (input.transcript_path && fs2.existsSync(input.transcript_path)) {
      const summary = parseTranscript(input.transcript_path);
      const handoffContent = generateAutoHandoff(summary, sessionName);
      const handoffDir = continuityDirectory(projectDir, ["thoughts", "shared", "handoffs", sessionName], true);
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const candidate = `auto-handoff-${timestamp}.yaml`;
      const written = handoffDir && withContinuityFile(
        handoffDir,
        candidate,
        fs2.constants.O_WRONLY | fs2.constants.O_CREAT | fs2.constants.O_EXCL,
        (fd) => {
          fs2.writeFileSync(fd, handoffContent);
          return true;
        }
      );
      if (written) handoffFile = candidate;
    }
    const briefSummary = generateAutoSummary(projectDir, input.session_id);
    const appended = briefSummary && appendToLedger(ledgerDir, mostRecent, briefSummary);
    const message = handoffFile ? `[PreCompact:auto] Created YAML handoff: thoughts/shared/handoffs/${sessionName}/${handoffFile}` : appended ? `[PreCompact:auto] Session summary auto-appended to ${mostRecent}` : "[PreCompact:auto] No continuity update saved. Save a brief task summary before compacting.";
    const output = {
      continue: true,
      systemMessage: message
    };
    endTimer(_perfStart, "pre-compact-continuity", "PreCompact");
    console.log(JSON.stringify(output));
  } else {
    const output = {
      continue: true,
      systemMessage: `[PreCompact] Save a brief task summary in the ledger before compacting.
Ledger: ${mostRecent}`
    };
    endTimer(_perfStart, "pre-compact-continuity", "PreCompact");
    console.log(JSON.stringify(output));
  }
}
function extractStrategicContext(sessionId) {
  const lines = [];
  const claudeDir = path.join(homedir2(), ".claude");
  const ledgerPath = path.join(claudeDir, "canavar", "error-ledger.jsonl");
  if (fs2.existsSync(ledgerPath)) {
    try {
      const allErrors = fs2.readFileSync(ledgerPath, "utf-8").split("\n").filter((l) => l.trim());
      const sessionErrors = allErrors.map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      }).filter((e) => e && e.session === sessionId?.slice(0, 8));
      if (sessionErrors.length > 0) {
        const patterns = [...new Set(sessionErrors.map((e) => e.error_pattern))];
        lines.push(`- Basarisiz yaklasimlar: ${patterns.slice(0, 5).join(", ")}`);
      }
    } catch {
    }
  }
  const intentPath = path.join(claudeDir, "cache", "current-intent.json");
  if (fs2.existsSync(intentPath)) {
    try {
      const intent = JSON.parse(fs2.readFileSync(intentPath, "utf-8"));
      if (intent.task_type && intent.task_type !== "conversational") {
        lines.push(`- Kullanici hedefi: ${intent.task_type} (domain: ${intent.domain?.join(", ") || "genel"})`);
      }
    } catch {
    }
  }
  const maturePath = path.join(claudeDir, "mature-instincts.json");
  if (fs2.existsSync(maturePath)) {
    try {
      const instincts = JSON.parse(fs2.readFileSync(maturePath, "utf-8"));
      const recent = instincts.filter((i) => i.confidence >= 5).slice(0, 3).map((i) => `${i.pattern}(${i.confidence}x)`);
      if (recent.length > 0) {
        lines.push(`- Gozlemlenen pattern'lar: ${recent.join(", ")}`);
      }
    } catch {
    }
  }
  return lines;
}
function generateAutoSummary(projectDir, sessionId) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const lines = [];
  const cacheDir = path.join(projectDir, ".claude", "tsc-cache", sessionId || "default");
  const editedFilesPath = path.join(cacheDir, "edited-files.log");
  let editedFiles = [];
  if (fs2.existsSync(editedFilesPath)) {
    const content = fs2.readFileSync(editedFilesPath, "utf-8");
    editedFiles = [...new Set(
      content.split("\n").filter((line) => line.trim()).map((line) => {
        const parts = line.split(":");
        return parts[1]?.replace(projectDir + "/", "") || "";
      }).filter((f) => f)
    )];
  }
  const gitClaudeDir = path.join(projectDir, ".git", "claude", "branches");
  let buildAttempts = { passed: 0, failed: 0 };
  if (fs2.existsSync(gitClaudeDir)) {
    try {
      const branches = fs2.readdirSync(gitClaudeDir);
      for (const branch of branches) {
        const attemptsFile = path.join(gitClaudeDir, branch, "attempts.jsonl");
        if (fs2.existsSync(attemptsFile)) {
          const content = fs2.readFileSync(attemptsFile, "utf-8");
          content.split("\n").filter((l) => l.trim()).forEach((line) => {
            try {
              const attempt = JSON.parse(line);
              if (attempt.type === "build_pass") buildAttempts.passed++;
              if (attempt.type === "build_fail") buildAttempts.failed++;
            } catch {
            }
          });
        }
      }
    } catch {
    }
  }
  const strategicLines = extractStrategicContext(sessionId);
  if (editedFiles.length === 0 && buildAttempts.passed === 0 && buildAttempts.failed === 0 && strategicLines.length === 0) {
    return null;
  }
  lines.push(`
## Session Auto-Summary (${timestamp})`);
  if (editedFiles.length > 0) {
    lines.push(`- Files changed: ${editedFiles.slice(0, 10).join(", ")}${editedFiles.length > 10 ? ` (+${editedFiles.length - 10} more)` : ""}`);
  }
  if (buildAttempts.passed > 0 || buildAttempts.failed > 0) {
    lines.push(`- Build/test: ${buildAttempts.passed} passed, ${buildAttempts.failed} failed`);
  }
  if (strategicLines.length > 0) {
    lines.push("- Stratejik context:");
    for (const sl of strategicLines) {
      lines.push(`  ${sl}`);
    }
  }
  return lines.join("\n");
}
function appendToLedger(directory, name, summary) {
  return withContinuityFile(directory, name, fs2.constants.O_RDWR, (fd) => {
    let content = fs2.readFileSync(fd, "utf-8");
    const stateMatch = content.match(/## State\n/);
    if (stateMatch) {
      const nowMatch = content.match(/(\n-\s*Now:)/);
      if (nowMatch && nowMatch.index) {
        content = content.slice(0, nowMatch.index) + summary + content.slice(nowMatch.index);
      } else {
        const nextSection = content.indexOf("\n## ", content.indexOf("## State") + 1);
        if (nextSection > 0) {
          content = content.slice(0, nextSection) + summary + "\n" + content.slice(nextSection);
        } else {
          content += summary;
        }
      }
    } else {
      content += summary;
    }
    if (!isContinuityDirectory(directory)) return false;
    const bytes = Buffer.from(content, "utf-8");
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs2.writeSync(fd, bytes, offset, bytes.length - offset, offset);
    }
    fs2.ftruncateSync(fd, bytes.length);
    return true;
  }) === true;
}
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
main().catch(console.error);
