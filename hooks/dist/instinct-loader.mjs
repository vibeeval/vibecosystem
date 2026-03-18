// src/instinct-loader.ts
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
import { homedir } from "os";

// src/shared/project-identity.ts
import { execSync } from "child_process";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join, basename, resolve } from "path";
var cachedIdentity = null;
function getProjectIdentity() {
  if (cachedIdentity) return cachedIdentity;
  const projectPath = getGitRoot();
  if (!projectPath) return null;
  const hash = createHash("md5").update(projectPath).digest("hex").slice(0, 12);
  const name = detectProjectName(projectPath);
  cachedIdentity = { hash, name, path: projectPath };
  return cachedIdentity;
}
function getGitRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return resolve(process.env.CLAUDE_PROJECT_DIR);
  }
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      timeout: 500,
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return root || null;
  } catch {
    return null;
  }
}
function detectProjectName(projectPath) {
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.name && typeof pkg.name === "string") return pkg.name;
    } catch {
    }
  }
  const goModPath = join(projectPath, "go.mod");
  if (existsSync(goModPath)) {
    try {
      const content = readFileSync(goModPath, "utf-8");
      const match = /^module\s+(\S+)/m.exec(content);
      if (match) {
        const parts = match[1].trim().split("/");
        return parts[parts.length - 1];
      }
    } catch {
    }
  }
  const pyPath = join(projectPath, "pyproject.toml");
  if (existsSync(pyPath)) {
    try {
      const content = readFileSync(pyPath, "utf-8");
      const section = content.match(/\[project\]\s*\n([\s\S]*?)(?:\n\[|$)/);
      if (section) {
        const nameMatch = /^name\s*=\s*"(.+?)"/m.exec(section[1]);
        if (nameMatch) return nameMatch[1];
      }
    } catch {
    }
  }
  const cargoPath = join(projectPath, "Cargo.toml");
  if (existsSync(cargoPath)) {
    try {
      const content = readFileSync(cargoPath, "utf-8");
      const section = content.match(/\[package\]\s*\n([\s\S]*?)(?:\n\[|$)/);
      if (section) {
        const nameMatch = /^name\s*=\s*"(.+?)"/m.exec(section[1]);
        if (nameMatch) return nameMatch[1];
      }
    } catch {
    }
  }
  return basename(projectPath);
}

// src/instinct-loader.ts
var INJECT_THRESHOLD = 5;
var MAX_INJECT = 10;
var MAX_GLOBAL_INJECT = 5;
var TEAM_ERRORS_DAYS = 7;
var MAX_TEAM_ERRORS = 5;
function main() {
  try {
    readFileSync2(0, "utf-8");
  } catch {
  }
  const claudeDir = join2(homedir(), ".claude");
  const identity = getProjectIdentity();
  const lines = [];
  let projectMature = [];
  if (identity) {
    const projectMaturePath = join2(claudeDir, "projects", identity.hash, "instincts", "mature-instincts.json");
    if (existsSync2(projectMaturePath)) {
      try {
        projectMature = JSON.parse(readFileSync2(projectMaturePath, "utf-8"));
      } catch {
      }
    }
  }
  const projectInjectable = projectMature.filter((i) => i.confidence >= INJECT_THRESHOLD).sort((a, b) => b.confidence - a.confidence).slice(0, MAX_INJECT);
  let globalInstincts = [];
  const globalPath = join2(claudeDir, "global-instincts.json");
  if (existsSync2(globalPath)) {
    try {
      globalInstincts = JSON.parse(readFileSync2(globalPath, "utf-8"));
    } catch {
    }
  }
  const globalInjectable = globalInstincts.slice(0, MAX_GLOBAL_INJECT);
  let legacyMature = [];
  if (projectInjectable.length === 0) {
    const legacyPath = join2(claudeDir, "mature-instincts.json");
    if (existsSync2(legacyPath)) {
      try {
        legacyMature = JSON.parse(readFileSync2(legacyPath, "utf-8"));
      } catch {
      }
    }
  }
  const legacyInjectable = legacyMature.filter((i) => i.confidence >= INJECT_THRESHOLD).sort((a, b) => b.confidence - a.confidence).slice(0, MAX_INJECT);
  if (projectInjectable.length === 0 && globalInjectable.length === 0 && legacyInjectable.length === 0) {
    const teamErrorLines2 = loadTeamErrors();
    if (teamErrorLines2.length > 0) {
      console.log(JSON.stringify({
        result: "Loaded team errors",
        systemMessage: teamErrorLines2.join("\n")
      }));
    } else {
      console.log("{}");
    }
    return;
  }
  if (projectInjectable.length > 0) {
    const projectName = identity?.name || "unknown";
    lines.push(`--- PROJECT PATTERNS: ${projectName} ---`);
    lines.push("");
    for (const inst of projectInjectable) {
      const promoted = inst.promoted ? " [RULE]" : "";
      lines.push(`[${inst.type}] ${inst.pattern} (${inst.count}x)${promoted}`);
      if (inst.examples.length > 0) {
        lines.push(`  ornek: ${inst.examples[0]}`);
      }
    }
    lines.push("");
  }
  if (legacyInjectable.length > 0) {
    lines.push("--- LEARNED PATTERNS (Otomatik Ogrenilmis) ---");
    lines.push("");
    for (const inst of legacyInjectable) {
      const promoted = inst.promoted ? " [RULE]" : "";
      lines.push(`[${inst.type}] ${inst.pattern} (${inst.count}x)${promoted}`);
      if (inst.examples.length > 0) {
        lines.push(`  ornek: ${inst.examples[0]}`);
      }
    }
    lines.push("");
  }
  if (globalInjectable.length > 0) {
    lines.push("--- GLOBAL PATTERNS (Cross-Project) ---");
    lines.push("");
    for (const gi of globalInjectable) {
      const projectNames = gi.projects.map((p) => p.name).join(", ");
      lines.push(`[${gi.type}] ${gi.pattern} (${gi.totalCount}x across ${gi.projects.length} projects)`);
      lines.push(`  projeler: ${projectNames}`);
      if (gi.examples.length > 0) {
        lines.push(`  ornek: ${gi.examples[0]}`);
      }
    }
    lines.push("");
  }
  const totalProject = projectInjectable.length;
  const totalGlobal = globalInjectable.length;
  const totalLegacy = legacyInjectable.length;
  lines.push(`--- ${totalProject + totalGlobal + totalLegacy} pattern toplam (${totalProject} project, ${totalGlobal} global, ${totalLegacy} legacy) ---`);
  const teamErrorLines = loadTeamErrors();
  if (teamErrorLines.length > 0) {
    lines.push("");
    lines.push(...teamErrorLines);
  }
  const parts = [];
  if (totalProject > 0) parts.push(`${totalProject} project`);
  if (totalGlobal > 0) parts.push(`${totalGlobal} global`);
  if (totalLegacy > 0) parts.push(`${totalLegacy} legacy`);
  if (teamErrorLines.length > 0) parts.push("team errors");
  const resultMsg = `Loaded ${parts.join(" + ")} patterns`;
  console.log(JSON.stringify({
    result: resultMsg,
    systemMessage: lines.join("\n")
  }));
}
function loadTeamErrors() {
  const ledgerPath = join2(homedir(), ".claude", "canavar", "error-ledger.jsonl");
  if (!existsSync2(ledgerPath)) return [];
  const cutoff = /* @__PURE__ */ new Date();
  cutoff.setDate(cutoff.getDate() - TEAM_ERRORS_DAYS);
  const lines = readFileSync2(ledgerPath, "utf-8").split("\n").filter((l) => l.trim());
  const recent = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (new Date(entry.ts) >= cutoff) {
        recent.push(entry);
      }
    } catch {
    }
  }
  if (recent.length === 0) return [];
  const grouped = /* @__PURE__ */ new Map();
  for (const e of recent) {
    const key = `${e.agent_type}:${e.error_pattern}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(key, { count: 1, agent: e.agent_type, lesson: e.lesson });
    }
  }
  const sorted = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, MAX_TEAM_ERRORS);
  const result = [
    `--- TAKIM HATALARI (Son ${TEAM_ERRORS_DAYS} Gun) ---`
  ];
  for (const entry of sorted) {
    result.push(`[${entry.count}x] ${entry.agent}: ${entry.lesson}`);
  }
  return result;
}
main();
