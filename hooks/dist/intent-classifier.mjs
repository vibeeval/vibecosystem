// src/intent-classifier.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// src/shared/task-detector.ts
var IMPLEMENTATION_INDICATORS = [
  { pattern: /\bimplement\b/i, keyword: "implement", type: "implementation", weight: 0.9 },
  { pattern: /\bbuild\b/i, keyword: "build", type: "implementation", weight: 0.9 },
  { pattern: /\bcreate\b/i, keyword: "create", type: "implementation", weight: 0.8 },
  { pattern: /\badd\s+(a\s+)?feature/i, keyword: "add feature", type: "implementation", weight: 0.85 },
  { pattern: /\bwrite\s+(a\s+)?(function|class|method|component|module)/i, keyword: "write", type: "implementation", weight: 0.85 },
  { pattern: /\bdevelop\b/i, keyword: "develop", type: "implementation", weight: 0.8 },
  { pattern: /\bset\s*up\b/i, keyword: "set up", type: "implementation", weight: 0.7 },
  { pattern: /\bconfigure\b/i, keyword: "configure", type: "implementation", weight: 0.7 },
  { pattern: /\brefactor\b/i, keyword: "refactor", type: "implementation", weight: 0.8 },
  { pattern: /\bmigrate\b/i, keyword: "migrate", type: "implementation", weight: 0.75 }
];
var DEBUG_INDICATORS = [
  { pattern: /\bdebug\b/i, keyword: "debug", type: "debug", weight: 0.9 },
  { pattern: /\bfix\s+(the\s+)?(bug|issue|error|problem)/i, keyword: "fix bug", type: "debug", weight: 0.9 },
  { pattern: /\binvestigate\b/i, keyword: "investigate", type: "debug", weight: 0.85 },
  { pattern: /\btroubleshoot\b/i, keyword: "troubleshoot", type: "debug", weight: 0.85 },
  { pattern: /\bdiagnose\b/i, keyword: "diagnose", type: "debug", weight: 0.8 },
  { pattern: /\bwhy\s+is\s+.*\b(failing|broken|not\s+working)/i, keyword: "why failing", type: "debug", weight: 0.75 },
  { pattern: /\bfix\b/i, keyword: "fix", type: "debug", weight: 0.6 }
];
var RESEARCH_INDICATORS = [
  { pattern: /\bhow\s+do\s+I\b/i, keyword: "how do I", type: "research", weight: 0.85 },
  { pattern: /\bfind\s+out\b/i, keyword: "find out", type: "research", weight: 0.8 },
  { pattern: /\bresearch\b/i, keyword: "research", type: "research", weight: 0.85 },
  { pattern: /\blook\s+into\b/i, keyword: "look into", type: "research", weight: 0.8 },
  { pattern: /\bexplore\s+(the\s+)?(options|possibilities|approaches)/i, keyword: "explore", type: "research", weight: 0.75 },
  { pattern: /\bwhat\s+are\s+(the\s+)?(best\s+practices|options|ways)/i, keyword: "best practices", type: "research", weight: 0.7 },
  { pattern: /\blearn\s+about\b/i, keyword: "learn about", type: "research", weight: 0.7 }
];
var PLANNING_INDICATORS = [
  { pattern: /\bplan\b/i, keyword: "plan", type: "planning", weight: 0.85 },
  { pattern: /\bdesign\b/i, keyword: "design", type: "planning", weight: 0.85 },
  { pattern: /\barchitect\b/i, keyword: "architect", type: "planning", weight: 0.9 },
  { pattern: /\boutline\b/i, keyword: "outline", type: "planning", weight: 0.75 },
  { pattern: /\bstrateg(y|ize)\b/i, keyword: "strategy", type: "planning", weight: 0.8 },
  { pattern: /\bpropose\b/i, keyword: "propose", type: "planning", weight: 0.7 },
  { pattern: /\bstructure\b/i, keyword: "structure", type: "planning", weight: 0.65 }
];
var CONVERSATIONAL_PATTERNS = [
  /\bwhat\s+is\b/i,
  /\bexplain\b/i,
  /\bshow\s+me\b/i,
  /\btell\s+me\s+about\b/i,
  /\bdescribe\b/i,
  /\bcan\s+you\s+explain\b/i,
  /\bhelp\s+me\s+understand\b/i,
  /\bwhat\s+does\b/i,
  /\bhow\s+does\b/i,
  /\bwhy\s+does\b/i,
  /\bwhat's\s+the\s+difference\b/i,
  /\bhello\b/i,
  /\bhi\b/i,
  /\bthanks?\b/i,
  /\bthank\s+you\b/i,
  /\bgreat\b/i,
  /\bnice\b/i,
  /\bgood\s+job\b/i,
  /\bwhat\s+happened\b/i
];
var ALL_TASK_INDICATORS = [
  ...IMPLEMENTATION_INDICATORS,
  ...DEBUG_INDICATORS,
  ...RESEARCH_INDICATORS,
  ...PLANNING_INDICATORS
];
function detectTask(prompt) {
  if (!prompt?.trim()) {
    return {
      isTask: false,
      confidence: 0,
      triggers: []
    };
  }
  const promptLower = prompt.toLowerCase();
  const conversationalMatches = CONVERSATIONAL_PATTERNS.filter((p) => p.test(promptLower));
  const matches = [];
  for (const indicator of ALL_TASK_INDICATORS) {
    if (indicator.pattern.test(promptLower)) {
      matches.push({ indicator, keyword: indicator.keyword });
    }
  }
  if (matches.length === 0) {
    return {
      isTask: false,
      confidence: 0,
      triggers: []
    };
  }
  let totalWeight = 0;
  for (const match of matches) {
    totalWeight += match.indicator.weight;
  }
  let confidence = totalWeight / matches.length;
  const uniqueTypes = new Set(matches.map((m) => m.indicator.type));
  if (uniqueTypes.size > 1) {
    confidence += 0.1;
  }
  if (matches.length > 2) {
    confidence += Math.min(0.05 * (matches.length - 2), 0.15);
  }
  if (conversationalMatches.length > 0) {
    confidence -= 0.3 * conversationalMatches.length;
  }
  if (confidence < 0.4) {
    return {
      isTask: false,
      confidence: Math.max(0, confidence),
      triggers: []
    };
  }
  confidence = Math.min(1, Math.max(0, confidence));
  const sortedMatches = [...matches].sort(
    (a, b) => b.indicator.weight - a.indicator.weight
  );
  const primaryType = sortedMatches[0].indicator.type;
  const triggers = [...new Set(matches.map((m) => m.keyword))];
  return {
    isTask: true,
    taskType: primaryType,
    confidence,
    triggers
  };
}

// src/intent-classifier.ts
var DOMAIN_PATTERNS = [
  { regex: /\b(typescript|\.ts|\.tsx|react|next\.?js|node)\b/i, domain: "typescript" },
  { regex: /\b(python|\.py|django|flask|fastapi)\b/i, domain: "python" },
  { regex: /\b(go|golang|\.go)\b/i, domain: "go" },
  { regex: /\b(rust|\.rs|cargo)\b/i, domain: "rust" },
  { regex: /\b(sql|database|postgres|mysql|sqlite|prisma|migration)\b/i, domain: "database" },
  { regex: /\b(docker|kubernetes|k8s|ci\/cd|deploy|infra)\b/i, domain: "devops" },
  { regex: /\b(css|tailwind|styled|scss|styling|ui|component)\b/i, domain: "frontend" },
  { regex: /\b(api|endpoint|rest|graphql|grpc)\b/i, domain: "api" },
  { regex: /\b(test|spec|jest|vitest|playwright|e2e)\b/i, domain: "testing" },
  { regex: /\b(auth|security|token|jwt|oauth|permission)\b/i, domain: "security" },
  { regex: /\b(ai|llm|model|prompt|embedding|vector)\b/i, domain: "ai" }
];
var AGENT_HINTS = [
  { regex: /\b(fix|debug|bug|broken|not working|hata|calismıyor)\b/i, agent: "sleuth" },
  { regex: /\b(refactor|clean|dead code|tech debt)\b/i, agent: "refactor-cleaner" },
  { regex: /\b(test|tdd|coverage)\b/i, agent: "tdd-guide" },
  { regex: /\b(deploy|release|ci|cd)\b/i, agent: "devops" },
  { regex: /\b(security|audit|vulnerability)\b/i, agent: "security-reviewer" },
  { regex: /\b(plan|architect|design system)\b/i, agent: "architect" },
  { regex: /\b(review|code review)\b/i, agent: "code-reviewer" },
  { regex: /\b(performance|slow|optimize|profil)\b/i, agent: "profiler" }
];
var SKILL_PATTERNS = [
  { regex: /\b(react|component|hook|useState|useEffect)\b/i, skill: "frontend-patterns" },
  { regex: /\b(api|endpoint|route|middleware)\b/i, skill: "backend-patterns" },
  { regex: /\b(test|spec|mock|fixture)\b/i, skill: "testing-patterns" },
  { regex: /\b(sql|query|schema|migration)\b/i, skill: "database-patterns" },
  { regex: /\b(docker|k8s|pipeline)\b/i, skill: "devops-patterns" }
];
function classifyIntent(input) {
  const prompt = input.prompt || "";
  const detection = detectTask(prompt);
  let taskType = "conversational";
  if (detection.isTask && detection.taskType && detection.taskType !== "unknown") {
    taskType = detection.taskType;
  }
  const domains = [];
  for (const dp of DOMAIN_PATTERNS) {
    if (dp.regex.test(prompt)) {
      domains.push(dp.domain);
    }
  }
  let agentHint = null;
  for (const ah of AGENT_HINTS) {
    if (ah.regex.test(prompt)) {
      agentHint = ah.agent;
      break;
    }
  }
  const skillsNeeded = [];
  for (const sp of SKILL_PATTERNS) {
    if (sp.regex.test(prompt)) {
      skillsNeeded.push(sp.skill);
    }
  }
  return {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    session_id: input.session_id?.slice(0, 8) || "unknown",
    task_type: taskType,
    confidence: detection.confidence,
    domain: domains,
    skills_needed: skillsNeeded,
    agent_hint: agentHint
  };
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
  const intent = classifyIntent(input);
  const cacheDir = join(homedir(), ".claude", "cache");
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  const intentPath = join(cacheDir, "current-intent.json");
  try {
    writeFileSync(intentPath, JSON.stringify(intent, null, 2));
  } catch {
  }
  if (intent.task_type !== "conversational") {
    console.log(JSON.stringify({
      result: "continue"
    }));
  } else {
    console.log("{}");
  }
}
main();
