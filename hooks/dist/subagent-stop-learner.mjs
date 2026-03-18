// src/subagent-stop-learner.ts
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var LEARNING_PATTERNS = {
  // Error → Fix patterns
  error_fix: [
    { regex: /(?:fixed|resolved|solved)\s+(?:by|with|using)\s+(.{10,120})/gi, label: "error-fix", confidence: 0.8 },
    { regex: /(?:the\s+)?(?:issue|problem|bug|error)\s+was\s+(.{10,120})/gi, label: "root-cause", confidence: 0.8 },
    { regex: /(?:root\s+cause)[:\s]+(.{10,120})/gi, label: "root-cause", confidence: 0.9 },
    { regex: /(?:caused\s+by)\s+(.{10,120})/gi, label: "root-cause", confidence: 0.7 }
  ],
  // Successful approaches
  success: [
    { regex: /(?:works?|worked|working)\s+(?:correctly|properly|well|as expected)(?:[.!]\s*(.{10,100}))?/gi, label: "working-approach", confidence: 0.6 },
    { regex: /(?:solution|approach|fix)[:\s]+(.{10,120})/gi, label: "working-solution", confidence: 0.7 },
    { regex: /(?:successfully)\s+(.{10,100})/gi, label: "success", confidence: 0.6 }
  ],
  // Failed approaches
  failure: [
    { regex: /(?:didn'?t\s+work|failed|doesn'?t\s+work|won'?t\s+work)[:\s]*(.{10,100})/gi, label: "failed-approach", confidence: 0.7 },
    { regex: /(?:avoid|don'?t|never|careful\s+with)\s+(.{10,100})/gi, label: "anti-pattern", confidence: 0.6 }
  ],
  // Architectural decisions
  decision: [
    { regex: /(?:decided|chose|chosen|selected)\s+(?:to\s+)?(.{10,100})\s+(?:because|since|as)/gi, label: "decision", confidence: 0.7 },
    { regex: /(?:better\s+to|prefer|recommended)\s+(.{10,100})/gi, label: "recommendation", confidence: 0.6 }
  ],
  // Pattern discovery
  pattern: [
    { regex: /(?:pattern|convention|standard)[:\s]+(.{10,100})/gi, label: "codebase-pattern", confidence: 0.7 },
    { regex: /(?:found\s+that|discovered\s+that|noticed\s+that)\s+(.{10,120})/gi, label: "discovery", confidence: 0.7 },
    { regex: /(?:all\s+(?:files?|components?|modules?)\s+(?:use|follow|implement))\s+(.{10,100})/gi, label: "codebase-pattern", confidence: 0.6 }
  ],
  // Security findings
  security: [
    { regex: /(?:vulnerabilit(?:y|ies)|security\s+(?:issue|risk|concern))[:\s]+(.{10,120})/gi, label: "security-finding", confidence: 0.8 },
    { regex: /(?:injection|xss|csrf|ssrf|exposed|leaked)[:\s]*(.{10,100})/gi, label: "security-risk", confidence: 0.8 }
  ],
  // Performance findings
  performance: [
    { regex: /(?:slow|performance|bottleneck|optimization)[:\s]+(.{10,100})/gi, label: "performance-finding", confidence: 0.6 },
    { regex: /(?:O\(n[\^2]?\)|quadratic|exponential|memory\s+leak)/gi, label: "performance-risk", confidence: 0.7 }
  ]
};
var HIGH_VALUE_AGENTS = /* @__PURE__ */ new Set([
  "sleuth",
  "scout",
  "kraken",
  "spark",
  "architect",
  "phoenix",
  "code-reviewer",
  "security-reviewer",
  "profiler",
  "build-error-resolver",
  "tdd-guide",
  "database-reviewer",
  "verifier",
  "self-learner"
]);
function extractLearnings(output, agentType, description, sessionId) {
  if (!output || output.length < 20) return [];
  const learnings = [];
  const seen = /* @__PURE__ */ new Set();
  const text = output.slice(0, 3e3);
  for (const [_category, patterns] of Object.entries(LEARNING_PATTERNS)) {
    for (const { regex, label, confidence } of patterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const detail = (match[1] || match[0]).trim();
        if (detail.length < 10 || detail.length > 150) continue;
        const key = `${label}:${detail.slice(0, 40)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        learnings.push({
          ts: (/* @__PURE__ */ new Date()).toISOString(),
          session: sessionId.slice(0, 8),
          type: "agent_learning",
          agent_type: agentType,
          pattern: `${agentType}:${label}`,
          detail: detail.slice(0, 150),
          confidence: HIGH_VALUE_AGENTS.has(agentType) ? confidence : confidence * 0.7,
          task_description: description.slice(0, 80)
        });
        if (learnings.filter((l) => l.pattern === `${agentType}:${label}`).length >= 3) break;
      }
    }
  }
  const hasError = /(?:error|failed|failure|exception|crash)/i.test(text);
  const hasSuccess = /(?:success|completed|passed|verified|all\s+(?:tests?\s+)?pass)/i.test(text);
  if (hasError && !hasSuccess) {
    learnings.push({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      session: sessionId.slice(0, 8),
      type: "agent_learning",
      agent_type: agentType,
      pattern: `${agentType}:task-failure`,
      detail: `Task failed: ${description.slice(0, 80)}`,
      confidence: 0.5,
      task_description: description.slice(0, 80)
    });
  }
  return learnings.slice(0, 8);
}
function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf-8");
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
  if (input.tool_name !== "Agent") {
    console.log("{}");
    return;
  }
  const agentType = input.tool_input?.subagent_type || "unknown";
  const description = input.tool_input?.description || "";
  const output = input.tool_output || "";
  const sessionId = input.session_id || "unknown";
  const learnings = extractLearnings(output, agentType, description, sessionId);
  if (learnings.length === 0) {
    console.log("{}");
    return;
  }
  const claudeDir = join(homedir(), ".claude");
  if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
  const instinctsPath = join(claudeDir, "instincts.jsonl");
  for (const learning of learnings) {
    appendFileSync(instinctsPath, JSON.stringify(learning) + "\n");
  }
  const agentLogPath = join(claudeDir, "agent-learnings.jsonl");
  const logEntry = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    session: sessionId.slice(0, 8),
    agent_type: agentType,
    description: description.slice(0, 100),
    learnings_count: learnings.length,
    patterns: learnings.map((l) => l.pattern)
  };
  appendFileSync(agentLogPath, JSON.stringify(logEntry) + "\n");
  console.log(JSON.stringify({
    result: `Extracted ${learnings.length} learnings from ${agentType} agent`
  }));
}
main();
