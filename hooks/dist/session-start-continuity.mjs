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
function loadBudget(path2) {
  try {
    const value = JSON.parse(readFileSync(path2, "utf8"));
    if (value.session_id === scope.sessionId && Number.isFinite(value.total_chars) && value.total_chars >= 0 && validCounters(value.per_hook) && validCounters(value.per_event) && value.seen && typeof value.seen === "object" && !Array.isArray(value.seen)) return value;
  } catch {
  }
  return freshBudget();
}
function withBudget(action, fallback) {
  const path2 = budgetPath();
  if (!path2) {
    localBudget ||= freshBudget();
    return action(localBudget);
  }
  const lock = `${path2}.lock`;
  let locked = false;
  let temporary;
  try {
    mkdirSync(dirname(path2), { recursive: true, mode: 448 });
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
    const budget = loadBudget(path2);
    const previous = JSON.stringify(budget);
    const result = action(budget);
    if (JSON.stringify(budget) === previous) return result;
    budget.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    temporary = `${path2}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(temporary, JSON.stringify(budget), { mode: 384 });
    renameSync(temporary, path2);
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

// src/session-start-continuity.ts
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
function parseHandoffDirName(dirName) {
  const match = dirName.match(/^(.+)-([0-9a-f]{8})$/i);
  if (match) {
    return { sessionName: match[1], uuidShort: match[2].toLowerCase() };
  }
  return { sessionName: dirName, uuidShort: null };
}
function isHandoffFile(filename) {
  return filename.endsWith(".md") || filename.endsWith(".yaml") || filename.endsWith(".yml");
}
function extractYamlFields(content) {
  const goalMatch = content.match(/^goal:\s*(.+)$/m);
  const nowMatch = content.match(/^now:\s*(.+)$/m);
  if (!goalMatch && !nowMatch) return null;
  return {
    goal: goalMatch ? goalMatch[1].trim().replace(/^["']|["']$/g, "") : "",
    now: nowMatch ? nowMatch[1].trim().replace(/^["']|["']$/g, "") : ""
  };
}
function extractLedgerSection(handoffContent) {
  const match = handoffContent.match(/(?:^|\n)## Ledger\n([\s\S]*?)(?=\n---\n|\n## [^#]|$)/);
  return match ? `## Ledger
${match[1].trim()}` : null;
}
function findSessionHandoff(sessionName) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const handoffDir = path.join(projectDir, "thoughts", "shared", "handoffs", sessionName);
  if (!fs.existsSync(handoffDir)) return null;
  const handoffFiles = fs.readdirSync(handoffDir).filter((f) => isHandoffFile(f)).sort((a, b) => {
    const statA = fs.statSync(path.join(handoffDir, a));
    const statB = fs.statSync(path.join(handoffDir, b));
    return statB.mtime.getTime() - statA.mtime.getTime();
  });
  return handoffFiles.length > 0 ? path.join(handoffDir, handoffFiles[0]) : null;
}
function pruneLedger(ledgerPath) {
  let content = fs.readFileSync(ledgerPath, "utf-8");
  const originalLength = content.length;
  content = content.replace(/\n### Session Ended \([^)]+\)\n- Reason: \w+\n/g, "");
  const agentReportsMatch = content.match(/## Agent Reports\n([\s\S]*?)(?=\n## |$)/);
  if (agentReportsMatch) {
    const agentReportsSection = agentReportsMatch[0];
    const reports = agentReportsSection.match(/### [^\n]+ \(\d{4}-\d{2}-\d{2}[^)]*\)[\s\S]*?(?=\n### |\n## |$)/g);
    if (reports && reports.length > 10) {
      const keptReports = reports.slice(-10);
      const newAgentReportsSection = "## Agent Reports\n" + keptReports.join("");
      content = content.replace(agentReportsSection, newAgentReportsSection);
    }
  }
  if (content.length !== originalLength) {
    fs.writeFileSync(ledgerPath, content);
    console.error(`Pruned ledger: ${originalLength} \u2192 ${content.length} bytes`);
  }
}
function getLatestHandoff(handoffDir) {
  if (!fs.existsSync(handoffDir)) return null;
  const handoffFiles = fs.readdirSync(handoffDir).filter((f) => (f.startsWith("task-") || f.startsWith("auto-handoff-")) && isHandoffFile(f)).sort((a, b) => {
    const statA = fs.statSync(path.join(handoffDir, a));
    const statB = fs.statSync(path.join(handoffDir, b));
    return statB.mtime.getTime() - statA.mtime.getTime();
  });
  if (handoffFiles.length === 0) return null;
  const latestFile = handoffFiles[0];
  const content = fs.readFileSync(path.join(handoffDir, latestFile), "utf-8");
  const isAutoHandoff = latestFile.startsWith("auto-handoff-");
  let taskNumber;
  let status;
  let summary;
  if (isAutoHandoff) {
    const typeMatch = content.match(/type:\s*auto-handoff/i);
    status = typeMatch ? "auto-handoff" : "unknown";
    const timestampMatch = latestFile.match(/auto-handoff-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    taskNumber = timestampMatch ? timestampMatch[1] : "auto";
    const inProgressMatch = content.match(/## In Progress\n([\s\S]*?)(?=\n## |$)/);
    summary = inProgressMatch ? inProgressMatch[1].trim().split("\n").slice(0, 3).join("; ").substring(0, 150) : "Auto-handoff from pre-compact";
  } else {
    const taskMatch = latestFile.match(/task-(\d+)/);
    taskNumber = taskMatch ? taskMatch[1] : "??";
    const statusMatch = content.match(/status:\s*(success|partial|blocked)/i);
    status = statusMatch ? statusMatch[1] : "unknown";
    const summaryMatch = content.match(/## What Was Done\n([\s\S]*?)(?=\n## |$)/);
    summary = summaryMatch ? summaryMatch[1].trim().split("\n").slice(0, 2).join("; ").substring(0, 150) : "No summary available";
  }
  return {
    filename: latestFile,
    taskNumber,
    status,
    summary,
    isAutoHandoff
  };
}
function getUnmarkedHandoffs() {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const dbPath = path.join(projectDir, ".claude", "cache", "artifact-index", "context.db");
    if (!fs.existsSync(dbPath)) {
      return [];
    }
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT id, session_name, task_number, task_summary FROM handoffs WHERE outcome = 'UNKNOWN' ORDER BY indexed_at DESC LIMIT 5"`,
      { encoding: "utf-8", timeout: 3e3 }
    );
    if (!result.trim()) {
      return [];
    }
    return result.trim().split("\n").map((line) => {
      const [id, session_name, task_number, task_summary] = line.split("|");
      return { id, session_name, task_number: task_number || null, task_summary: task_summary || "" };
    });
  } catch (error) {
    return [];
  }
}
async function main() {
  const input = readHookInput();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sessionType = input.source || input.type;
  let message = "";
  let additionalContext = "";
  let usedHandoffLedger = false;
  const handoffsDir = path.join(projectDir, "thoughts", "shared", "handoffs");
  if (fs.existsSync(handoffsDir)) {
    try {
      const sessionDirs = fs.readdirSync(handoffsDir).filter((d) => {
        const stat = fs.statSync(path.join(handoffsDir, d));
        return stat.isDirectory();
      });
      let mostRecentLedger = null;
      for (const sessionName of sessionDirs) {
        const handoffPath = findSessionHandoff(sessionName);
        if (handoffPath) {
          const content = fs.readFileSync(handoffPath, "utf-8");
          const isYaml = handoffPath.endsWith(".yaml") || handoffPath.endsWith(".yml");
          let goalSummary = "No goal found";
          let currentFocus = "Unknown";
          let ledgerContent = "";
          if (isYaml) {
            const yamlFields = extractYamlFields(content);
            if (yamlFields) {
              goalSummary = yamlFields.goal || "No goal found";
              currentFocus = yamlFields.now || "Unknown";
              ledgerContent = content;
            }
          } else {
            const ledgerSection = extractLedgerSection(content);
            if (ledgerSection) {
              const goalMatch = ledgerSection.match(/\*\*Goal:\*\*\s*([^\n]+)/);
              const nowMatch = ledgerSection.match(/### Now\n\[?-?>?\]?\s*([^\n]+)/);
              goalSummary = goalMatch ? goalMatch[1].trim().substring(0, 100) : "No goal found";
              currentFocus = nowMatch ? nowMatch[1].trim() : "Unknown";
              ledgerContent = ledgerSection;
            }
          }
          if (ledgerContent || isYaml && (goalSummary !== "No goal found" || currentFocus !== "Unknown")) {
            const mtime = fs.statSync(handoffPath).mtime.getTime();
            if (!mostRecentLedger || mtime > mostRecentLedger.mtime) {
              mostRecentLedger = {
                content: ledgerContent || content,
                sessionName,
                handoffPath,
                mtime,
                goalSummary: goalSummary.substring(0, 100),
                currentFocus
              };
            }
          }
        }
      }
      if (mostRecentLedger) {
        usedHandoffLedger = true;
        const { sessionName, goalSummary, currentFocus, content: ledgerSection, handoffPath } = mostRecentLedger;
        const handoffFilename = path.basename(handoffPath);
        if (sessionType === "startup") {
          message = `\u{1F4CB} Handoff Ledger: ${sessionName} \u2192 ${currentFocus} (run /resume_handoff to continue)`;
        } else {
          console.error(`\u2713 Handoff Ledger loaded: ${sessionName} \u2192 ${currentFocus}`);
          message = `[${sessionType}] Loaded from handoff: ${handoffFilename} | Goal: ${goalSummary} | Focus: ${currentFocus}`;
          if (sessionType === "clear" || sessionType === "compact") {
            additionalContext = `Handoff Ledger loaded from ${handoffFilename}:

${ledgerSection}`;
            const unmarkedHandoffs = getUnmarkedHandoffs();
            if (unmarkedHandoffs.length > 0) {
              additionalContext += `

---

## Unmarked Session Outcomes

`;
              additionalContext += `The following handoffs have no outcome marked. Consider marking them to improve future session recommendations:

`;
              for (const h of unmarkedHandoffs) {
                const taskLabel = h.task_number ? `task-${h.task_number}` : "handoff";
                const summaryPreview = h.task_summary ? h.task_summary.substring(0, 60) + "..." : "(no summary)";
                additionalContext += `- **${h.session_name}/${taskLabel}** (ID: \`${h.id.substring(0, 8)}\`): ${summaryPreview}
`;
              }
              additionalContext += `
To mark an outcome:
\`\`\`bash
cd ~/.claude && uv run python scripts/core/artifact_mark.py --handoff <ID> --outcome SUCCEEDED|PARTIAL_PLUS|PARTIAL_MINUS|FAILED
\`\`\`
`;
            }
            additionalContext += `

---

Full handoff available at: ${handoffPath}
`;
          }
        }
      }
    } catch (error) {
      console.error(`Warning: Error scanning handoffs: ${error}`);
    }
  }
  if (!usedHandoffLedger) {
    const ledgerDir = path.join(projectDir, "thoughts", "ledgers");
    if (!fs.existsSync(ledgerDir)) {
      console.log(JSON.stringify({ result: "continue" }));
      return;
    }
    const ledgerFiles = fs.readdirSync(ledgerDir).filter((f) => f.startsWith("CONTINUITY_CLAUDE-") && f.endsWith(".md")).sort((a, b) => {
      const statA = fs.statSync(path.join(ledgerDir, a));
      const statB = fs.statSync(path.join(ledgerDir, b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
    if (ledgerFiles.length > 0) {
      console.error("DEPRECATED: Using legacy ledger file. Migrate to handoff format with /create_handoff");
      const mostRecent = ledgerFiles[0];
      const ledgerPath = path.join(ledgerDir, mostRecent);
      pruneLedger(ledgerPath);
      const ledgerContent = fs.readFileSync(ledgerPath, "utf-8");
      const goalMatch = ledgerContent.match(/## Goal\n([\s\S]*?)(?=\n## |$)/);
      const nowMatch = ledgerContent.match(/- Now: ([^\n]+)/);
      const goalSummary = goalMatch ? goalMatch[1].trim().split("\n")[0].substring(0, 100) : "No goal found";
      const currentFocus = nowMatch ? nowMatch[1].trim() : "Unknown";
      const sessionName = mostRecent.replace("CONTINUITY_CLAUDE-", "").replace(".md", "");
      const handoffDir = path.join(projectDir, "thoughts", "shared", "handoffs", sessionName);
      const latestHandoff = getLatestHandoff(handoffDir);
      if (sessionType === "startup") {
        let startupMsg = `\u{1F4CB} Ledger available: ${sessionName} \u2192 ${currentFocus}`;
        if (latestHandoff) {
          if (latestHandoff.isAutoHandoff) {
            startupMsg += ` | Last handoff: auto (${latestHandoff.status})`;
          } else {
            startupMsg += ` | Last handoff: task-${latestHandoff.taskNumber} (${latestHandoff.status})`;
          }
        }
        startupMsg += " (run /resume_handoff to continue)";
        message = startupMsg;
      } else {
        console.error(`\u2713 Ledger loaded: ${sessionName} \u2192 ${currentFocus}`);
        message = `[${sessionType}] Loaded: ${mostRecent} | Goal: ${goalSummary} | Focus: ${currentFocus}`;
        if (sessionType === "clear" || sessionType === "compact") {
          additionalContext = `Continuity ledger loaded from ${mostRecent}:

${ledgerContent}`;
          const unmarkedHandoffs = getUnmarkedHandoffs();
          if (unmarkedHandoffs.length > 0) {
            additionalContext += `

---

## Unmarked Session Outcomes

`;
            additionalContext += `The following handoffs have no outcome marked. Consider marking them to improve future session recommendations:

`;
            for (const h of unmarkedHandoffs) {
              const taskLabel = h.task_number ? `task-${h.task_number}` : "handoff";
              const summaryPreview = h.task_summary ? h.task_summary.substring(0, 60) + "..." : "(no summary)";
              additionalContext += `- **${h.session_name}/${taskLabel}** (ID: \`${h.id.substring(0, 8)}\`): ${summaryPreview}
`;
            }
            additionalContext += `
To mark an outcome:
\`\`\`bash
cd ~/.claude && uv run python scripts/core/artifact_mark.py --handoff <ID> --outcome SUCCEEDED|PARTIAL_PLUS|PARTIAL_MINUS|FAILED
\`\`\`
`;
          }
          if (latestHandoff) {
            const handoffPath = path.join(handoffDir, latestHandoff.filename);
            const handoffContent = fs.readFileSync(handoffPath, "utf-8");
            const handoffLabel = latestHandoff.isAutoHandoff ? "Latest auto-handoff" : "Latest task handoff";
            additionalContext += `

---

${handoffLabel} (${latestHandoff.filename}):
`;
            additionalContext += `Status: ${latestHandoff.status}${latestHandoff.isAutoHandoff ? "" : ` | Task: ${latestHandoff.taskNumber}`}

`;
            const truncatedHandoff = handoffContent.length > 2e3 ? handoffContent.substring(0, 2e3) + "\n\n[... truncated, read full file if needed]" : handoffContent;
            additionalContext += truncatedHandoff;
            const allHandoffs = fs.readdirSync(handoffDir).filter((f) => (f.startsWith("task-") || f.startsWith("auto-handoff-")) && isHandoffFile(f)).sort((a, b) => {
              const statA = fs.statSync(path.join(handoffDir, a));
              const statB = fs.statSync(path.join(handoffDir, b));
              return statB.mtime.getTime() - statA.mtime.getTime();
            });
            if (allHandoffs.length > 1) {
              additionalContext += `

---

All handoffs in ${handoffDir}:
`;
              allHandoffs.forEach((f) => {
                additionalContext += `- ${f}
`;
              });
            }
          }
        }
      }
    } else {
      if (sessionType !== "startup") {
        console.error(`\u26A0 No ledger found. Run /continuity_ledger to track session state.`);
        message = `[${sessionType}] No ledger found. Consider running /continuity_ledger to track session state.`;
      }
    }
  }
  const output = { result: "continue" };
  if (message) {
    output.message = message;
    output.systemMessage = message;
  }
  if (additionalContext) {
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext
    };
  }
  console.log(JSON.stringify(budgetHookOutput(output, "session-start-continuity", "SessionStart")));
}
main().catch(console.error);
export {
  extractLedgerSection,
  extractYamlFields,
  findSessionHandoff,
  parseHandoffDirName
};
