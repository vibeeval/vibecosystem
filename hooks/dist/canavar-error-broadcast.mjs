// src/canavar-error-broadcast.ts
import { readFileSync as readFileSync2, appendFileSync, mkdirSync as mkdirSync2, existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";

// src/shared/notify.ts
import { execFileSync } from "child_process";
function notify(title, message, level = "info") {
  try {
    const subtitle = level === "critical" ? "CRITICAL" : level === "warning" ? "WARNING" : "";
    const script = `display notification "${esc(message)}" with title "${esc(title)}" ${subtitle ? `subtitle "${esc(subtitle)}"` : ""} sound name "Submarine"`;
    execFileSync("osascript", ["-e", script], { timeout: 2e3, stdio: "ignore" });
  } catch {
  }
}
function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").replace(/\r/g, " ").slice(0, 200);
}

// src/shared/github-bridge.ts
import { execFileSync as execFileSync2 } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var RATE_LIMIT_PATH = join(homedir(), ".claude", "cache", "github-rate-limit.json");
var MAX_ISSUES_PER_SESSION = 3;
function loadRateLimit() {
  try {
    if (existsSync(RATE_LIMIT_PATH)) {
      return JSON.parse(readFileSync(RATE_LIMIT_PATH, "utf-8"));
    }
  } catch {
  }
  return { session_id: "unknown", issues_created: 0, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
}
function saveRateLimit(state) {
  try {
    const cacheDir = join(homedir(), ".claude", "cache");
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(RATE_LIMIT_PATH, JSON.stringify(state, null, 2));
  } catch {
  }
}
function getCurrentRepo() {
  try {
    const result = execFileSync2("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], {
      encoding: "utf-8",
      timeout: 5e3,
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}
function createIssue(title, body, labels) {
  const state = loadRateLimit();
  if (state.issues_created >= MAX_ISSUES_PER_SESSION) {
    return null;
  }
  try {
    const args = ["issue", "create", "--title", title.slice(0, 256), "--body", body.slice(0, 4e3)];
    if (labels && labels.length > 0) {
      args.push("--label", labels.join(","));
    }
    const result = execFileSync2("gh", args, {
      encoding: "utf-8",
      timeout: 1e4,
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    state.issues_created++;
    state.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    saveRateLimit(state);
    return result || null;
  } catch {
    return null;
  }
}

// src/canavar-error-broadcast.ts
var ERROR_PATTERNS = [
  // Build / TypeScript errors
  {
    regex: /error TS(\d+):\s*(.+)/,
    type: "build_fail",
    pattern: "typescript-error",
    lesson: (m) => `TS${m[1]}: ${m[2].slice(0, 80)}`
  },
  {
    regex: /Cannot find module ['"](.+?)['"]/i,
    type: "build_fail",
    pattern: "missing-import",
    lesson: (m) => `${m[1]} import'u eksik`
  },
  {
    regex: /Property ['"](.+?)['"] does not exist/i,
    type: "type_error",
    pattern: "missing-property",
    lesson: (m) => `'${m[1]}' property'si yok`
  },
  {
    regex: /Type ['"](.+?)['"] is not assignable to type ['"](.+?)['"]/i,
    type: "type_error",
    pattern: "type-mismatch",
    lesson: (m) => `${m[1]} \u2192 ${m[2]} atanamaz`
  },
  // Test failures
  {
    regex: /FAIL\s+(.+?)$/m,
    type: "test_fail",
    pattern: "test-failure",
    lesson: (m) => `Test FAIL: ${m[1].trim().slice(0, 80)}`
  },
  {
    regex: /(\d+) failed/i,
    type: "test_fail",
    pattern: "test-failure",
    lesson: (m) => `${m[1]} test basarisiz`
  },
  // Runtime errors
  {
    regex: /TypeError:\s*(.+)/,
    type: "runtime_error",
    pattern: "type-runtime-error",
    lesson: (m) => `TypeError: ${m[1].slice(0, 80)}`
  },
  {
    regex: /ReferenceError:\s*(.+)/,
    type: "runtime_error",
    pattern: "reference-error",
    lesson: (m) => `ReferenceError: ${m[1].slice(0, 80)}`
  },
  {
    regex: /SyntaxError:\s*(.+)/,
    type: "build_fail",
    pattern: "syntax-error",
    lesson: (m) => `SyntaxError: ${m[1].slice(0, 80)}`
  },
  {
    regex: /(?:ENOENT|no such file|ENOENT: no such file or directory)[,:\s]+(?:open|stat|lstat|access|unlink|rename|read)?\s*['"](.+?)['"]/i,
    type: "runtime_error",
    pattern: "missing-file",
    lesson: (m) => `Dosya bulunamadi: ${m[1]}`
  },
  // Go errors
  {
    regex: /undefined:\s*(\w+)/,
    type: "build_fail",
    pattern: "go-undefined",
    lesson: (m) => `${m[1]} tanimlanmamis`
  },
  // Python errors
  {
    regex: /ModuleNotFoundError:\s*No module named ['"](.+?)['"]/,
    type: "runtime_error",
    pattern: "python-missing-module",
    lesson: (m) => `Python modul eksik: ${m[1]}`
  }
];
function extractFile(output, command) {
  const fileMatch = output.match(/(?:(?:\/|[A-Z]:\\)[\w\/.\\-]+\.\w+)/);
  if (fileMatch) return fileMatch[0].replace(/\\/g, "/");
  if (command) {
    const cmdFile = command.match(/(?:(?:\/|[A-Z]:\\)[\w\/.\\-]+\.\w+)/);
    if (cmdFile) return cmdFile[0].replace(/\\/g, "/");
  }
  return "unknown";
}
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
  const isAgentTool = input.tool_name === "Agent";
  const sessionId = input.session_id?.slice(0, 8) || "unknown";
  const agentId = isAgentTool ? input.tool_input?.subagent_type || "unknown-agent" : process.env.CLAUDE_AGENT_ID || "main";
  const agentType = isAgentTool ? input.tool_input?.subagent_type || "unknown-agent" : process.env.CLAUDE_AGENT_TYPE || "main";
  const output = isAgentTool ? typeof input.tool_output === "string" ? input.tool_output : "" : typeof input.tool_response === "string" ? input.tool_response : JSON.stringify(input.tool_response || "");
  if (!output || output.length < 10) {
    console.log("{}");
    return;
  }
  const errors = [];
  for (const ep of ERROR_PATTERNS) {
    const match = ep.regex.exec(output);
    if (match) {
      errors.push({
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        session: sessionId,
        agent_id: agentId,
        agent_type: agentType,
        error_type: ep.type,
        error_pattern: ep.pattern,
        detail: match[0].slice(0, 200),
        // Agent tool için dosya adını çıktıdan çıkar; Bash için komuttan da bak
        file: extractFile(output, isAgentTool ? void 0 : input.tool_input?.command),
        lesson: ep.lesson(match)
      });
    }
  }
  if (errors.length > 0) {
    const canavarDir = join2(homedir2(), ".claude", "canavar");
    if (!existsSync2(canavarDir)) mkdirSync2(canavarDir, { recursive: true });
    const ledgerPath = join2(canavarDir, "error-ledger.jsonl");
    for (const err of errors) {
      appendFileSync(ledgerPath, JSON.stringify(err) + "\n");
    }
    const criticalErrors = errors.filter((e) => e.error_type === "build_fail" || e.error_type === "runtime_error");
    if (criticalErrors.length > 0) {
      notify("Hizir: Hata Tespit", `${criticalErrors.length} kritik hata: ${criticalErrors[0].error_pattern}`, "critical");
    }
    try {
      const ledgerPath2 = join2(homedir2(), ".claude", "canavar", "error-ledger.jsonl");
      if (existsSync2(ledgerPath2)) {
        const allLines = readFileSync2(ledgerPath2, "utf-8").split("\n").filter((l) => l.trim());
        const patternCounts = /* @__PURE__ */ new Map();
        for (const line of allLines) {
          try {
            const entry = JSON.parse(line);
            patternCounts.set(entry.error_pattern, (patternCounts.get(entry.error_pattern) || 0) + 1);
          } catch {
          }
        }
        for (const err of errors) {
          const count = patternCounts.get(err.error_pattern) || 0;
          if (count >= 3 && getCurrentRepo()) {
            createIssue(
              `[Canavar] Tekrarlayan hata: ${err.error_pattern} (${count}x)`,
              `## Hata Detayi

- **Pattern:** ${err.error_pattern}
- **Tip:** ${err.error_type}
- **Tekrar:** ${count} kez
- **Son ders:** ${err.lesson}
- **Dosya:** ${err.file}

_Otomatik olusturuldu by Canavar_`,
              ["bug", "canavar"]
            );
            break;
          }
        }
      }
    } catch {
    }
  }
  console.log("{}");
}
main();
