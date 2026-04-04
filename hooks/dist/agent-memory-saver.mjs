// src/agent-memory-saver.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CLAUDE_HOME = join(homedir(), ".claude");
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
function sanitizeAgentType(agentType) {
  return agentType.replace(/[:/\\]/g, "-").replace(/\s+/g, "-").toLowerCase();
}
function ensureDir(dir) {
  if (!existsSync(dir)) {
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
    const input = JSON.parse(process.argv[2] || "{}");
    if (input.tool_name !== "Agent") return;
    const agentType = input.tool_input?.subagent_type;
    const output = input.tool_output || "";
    const description = input.tool_input?.description || "";
    if (!agentType || !output || output.length < 50) return;
    const hasLearning = hasLearningSignal(output);
    const hasSuccess = hasSuccessSignal(output);
    if (!hasLearning && !hasSuccess) return;
    const dirName = sanitizeAgentType(agentType);
    const memoryDir = join(CLAUDE_HOME, "agent-memory", dirName);
    ensureDir(memoryDir);
    const timestamp = getTimestamp();
    const keyInfo = extractKeyInfo(output);
    if (hasLearning) {
      const journalPath = join(memoryDir, "learnings.md");
      const entry = `
## ${timestamp} - ${description || "Agent task"}

${keyInfo}

---
`;
      appendFileSync(journalPath, entry, "utf-8");
      try {
        const content = readFileSync(journalPath, "utf-8");
        if (content.length > 5e4) {
          const truncated = content.substring(content.length - 4e4);
          const firstNewline = truncated.indexOf("\n## ");
          writeFileSync(journalPath, firstNewline > 0 ? truncated.substring(firstNewline) : truncated, "utf-8");
        }
      } catch {
      }
    }
    const memoryMdPath = join(memoryDir, "MEMORY.md");
    if (!existsSync(memoryMdPath)) {
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
