// src/canavar-cross-review.ts
import { readFileSync } from "fs";
var PRODUCER_AGENTS = /* @__PURE__ */ new Set([
  "spark",
  "kraken",
  "backend-dev",
  "frontend-dev",
  "phoenix",
  "devops",
  "refactor-cleaner",
  "database-reviewer",
  "go-build-resolver",
  "build-error-resolver"
]);
var REVIEWER_AGENTS = /* @__PURE__ */ new Set([
  "code-reviewer",
  "security-reviewer",
  "go-reviewer",
  "python-reviewer",
  "plan-reviewer",
  "review-agent"
]);
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
  const agentType = input.tool_input?.subagent_type || "";
  if (!PRODUCER_AGENTS.has(agentType)) {
    console.log("{}");
    return;
  }
  const parentType = process.env.CLAUDE_AGENT_TYPE || "";
  if (REVIEWER_AGENTS.has(parentType)) {
    console.log("{}");
    return;
  }
  const desc = input.tool_input?.description || "bilinmeyen gorev";
  const reviewChecks = [
    "type error",
    "missing error handling",
    "hardcoded values",
    "security (injection, secrets)",
    "import eksikligi"
  ];
  const message = [
    `CANAVAR CROSS-REVIEW: ${agentType} agent is tamamladi.`,
    `Gorev: ${desc}`,
    `Kontrol et: ${reviewChecks.join(", ")}.`,
    `Sorun varsa duzelt, yoksa devam et.`
  ].join(" ");
  console.log(JSON.stringify({
    systemMessage: message
  }));
}
main();
