// src/instinct-consolidator.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

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

// src/instinct-consolidator.ts
var MATURE_THRESHOLD = 5;
var PROMOTE_THRESHOLD = 10;
var MAX_EXAMPLES = 3;
var CROSS_PROJECT_MIN_PROJECTS = 2;
var CROSS_PROJECT_MIN_TOTAL = 5;
var MAX_JSONL_SIZE = 5 * 1024 * 1024;
function main() {
  try {
    readFileSync(0, "utf-8");
  } catch {
  }
  const claudeDir = join(homedir(), ".claude");
  const instinctsPath = join(claudeDir, "instincts.jsonl");
  const maturePath = join(claudeDir, "mature-instincts.json");
  if (!existsSync(instinctsPath)) {
    console.log("{}");
    return;
  }
  const processingPath = instinctsPath + ".processing";
  try {
    renameSync(instinctsPath, processingPath);
  } catch {
    console.log("{}");
    return;
  }
  let lines;
  try {
    const raw = readFileSync(processingPath, "utf-8");
    if (raw.length > MAX_JSONL_SIZE) {
      const allLines = raw.split("\n");
      lines = allLines.slice(-5e3).filter((l) => l.trim());
    } else {
      lines = raw.split("\n").filter((l) => l.trim());
    }
  } catch {
    try {
      renameSync(processingPath, instinctsPath);
    } catch {
    }
    console.log("{}");
    return;
  }
  if (lines.length === 0) {
    try {
      unlinkSync(processingPath);
    } catch {
    }
    console.log("{}");
    return;
  }
  const rawInstincts = [];
  for (const line of lines) {
    if (line.length > 1e4) continue;
    try {
      rawInstincts.push(JSON.parse(line));
    } catch {
    }
  }
  const matureMap = loadMatureMap(maturePath);
  consolidateInto(matureMap, rawInstincts);
  const matureList = [...matureMap.values()].sort((a, b) => b.confidence - a.confidence);
  atomicWriteJSON(maturePath, matureList);
  const projectGroups = groupByProject(rawInstincts);
  const registry = loadRegistry(claudeDir);
  for (const [projectHash, instincts] of projectGroups) {
    if (projectHash === "__global__") continue;
    if (!isValidHash(projectHash)) continue;
    const projectDir = join(claudeDir, "projects", projectHash, "instincts");
    if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });
    const projectMaturePath = join(projectDir, "mature-instincts.json");
    const projectMatureMap = loadMatureMap(projectMaturePath);
    consolidateInto(projectMatureMap, instincts);
    const projectMatureList = [...projectMatureMap.values()].sort((a, b) => b.confidence - a.confidence);
    atomicWriteJSON(projectMaturePath, projectMatureList);
    const firstInst = instincts[0];
    const existing = registry.projects[projectHash];
    registry.projects[projectHash] = {
      hash: projectHash,
      name: firstInst.projectName || existing?.name || projectHash,
      path: existing?.path || "",
      firstSeen: existing?.firstSeen || firstInst.ts,
      lastSeen: instincts[instincts.length - 1].ts,
      patternCount: projectMatureList.length
    };
  }
  registry.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const registryPath = join(claudeDir, "instinct-projects.json");
  atomicWriteJSON(registryPath, registry);
  const promoted = crossProjectPromote(claudeDir, matureList, rawInstincts, registry);
  const newlyPromoted = [];
  for (const m of matureList) {
    if (m.confidence >= PROMOTE_THRESHOLD && !m.promoted) {
      promoteToRule(m, claudeDir);
      m.promoted = true;
      newlyPromoted.push(m);
    }
  }
  if (newlyPromoted.length > 0) {
    atomicWriteJSON(maturePath, matureList);
    notify("Hizir: Instinct Promoted", `${newlyPromoted.length} pattern rule oldu: ${newlyPromoted.map((p) => p.pattern).join(", ")}`, "info");
  }
  if (promoted > 0) {
    notify("Hizir: Cross-Project", `${promoted} pattern global'e promote edildi`, "info");
  }
  try {
    unlinkSync(processingPath);
  } catch {
  }
  const matureCount = matureList.filter((m) => m.confidence >= MATURE_THRESHOLD).length;
  const parts = [`Instincts: ${rawInstincts.length} consolidated, ${matureCount} mature`];
  if (newlyPromoted.length > 0) parts.push(`${newlyPromoted.length} promoted to rules`);
  if (promoted > 0) parts.push(`${promoted} cross-project promoted`);
  console.log(JSON.stringify({ result: parts.join(", ") }));
}
function isValidHash(hash) {
  return /^[a-f0-9]{12}$/.test(hash);
}
function atomicWriteJSON(filePath, data) {
  const tmpPath = filePath + ".tmp." + process.pid;
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), { mode: 384 });
    renameSync(tmpPath, filePath);
  } catch {
    try {
      unlinkSync(tmpPath);
    } catch {
    }
  }
}
function loadMatureMap(path) {
  const map = /* @__PURE__ */ new Map();
  if (existsSync(path)) {
    try {
      const existing = JSON.parse(readFileSync(path, "utf-8"));
      for (const m of existing) {
        map.set(m.pattern, m);
      }
    } catch {
    }
  }
  return map;
}
function consolidateInto(map, instincts) {
  for (const inst of instincts) {
    const key = inst.pattern;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.last_seen = inst.ts;
      existing.confidence = existing.count;
      if (existing.examples.length < MAX_EXAMPLES && !existing.examples.includes(inst.detail)) {
        existing.examples.push(inst.detail);
      }
    } else {
      map.set(key, {
        pattern: inst.pattern,
        type: inst.type,
        count: 1,
        confidence: 1,
        first_seen: inst.ts,
        last_seen: inst.ts,
        examples: [inst.detail],
        promoted: false
      });
    }
  }
}
function groupByProject(instincts) {
  const groups = /* @__PURE__ */ new Map();
  for (const inst of instincts) {
    const key = inst.project || "__global__";
    const group = groups.get(key);
    if (group) {
      group.push(inst);
    } else {
      groups.set(key, [inst]);
    }
  }
  return groups;
}
function loadRegistry(claudeDir) {
  const registryPath = join(claudeDir, "instinct-projects.json");
  if (existsSync(registryPath)) {
    try {
      return JSON.parse(readFileSync(registryPath, "utf-8"));
    } catch {
    }
  }
  return { projects: {}, updatedAt: "" };
}
function crossProjectPromote(claudeDir, matureList, _rawInstincts, registry) {
  const globalPath = join(claudeDir, "global-instincts.json");
  let globalMap = /* @__PURE__ */ new Map();
  if (existsSync(globalPath)) {
    try {
      const existing = JSON.parse(readFileSync(globalPath, "utf-8"));
      for (const g of existing) {
        globalMap.set(g.pattern, g);
      }
    } catch {
    }
  }
  const patternProjects = /* @__PURE__ */ new Map();
  for (const [hash] of Object.entries(registry.projects)) {
    if (!isValidHash(hash)) continue;
    const projectMaturePath = join(claudeDir, "projects", hash, "instincts", "mature-instincts.json");
    if (!existsSync(projectMaturePath)) continue;
    try {
      const projectMature = JSON.parse(readFileSync(projectMaturePath, "utf-8"));
      for (const m of projectMature) {
        let projectMap = patternProjects.get(m.pattern);
        if (!projectMap) {
          projectMap = /* @__PURE__ */ new Map();
          patternProjects.set(m.pattern, projectMap);
        }
        projectMap.set(hash, { count: m.count, lastSeen: m.last_seen, firstSeen: m.first_seen });
      }
    } catch {
    }
  }
  let promotedCount = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const [pattern, projectMap] of patternProjects) {
    if (projectMap.size < CROSS_PROJECT_MIN_PROJECTS) continue;
    let totalCount = 0;
    const sources = [];
    let firstSeen = "";
    let lastSeen = "";
    for (const [hash, data] of projectMap) {
      totalCount += data.count;
      const info = registry.projects[hash];
      sources.push({
        hash,
        name: info?.name || hash,
        count: data.count,
        lastSeen: data.lastSeen
      });
      if (!firstSeen || data.firstSeen < firstSeen) firstSeen = data.firstSeen;
      if (!lastSeen || data.lastSeen > lastSeen) lastSeen = data.lastSeen;
    }
    if (totalCount < CROSS_PROJECT_MIN_TOTAL) continue;
    const existing = globalMap.get(pattern);
    if (existing) {
      existing.totalCount = totalCount;
      existing.projects = sources;
      existing.last_seen = lastSeen;
      existing.confidence = totalCount;
    } else {
      const mature = matureList.find((m) => m.pattern === pattern);
      globalMap.set(pattern, {
        pattern,
        type: mature?.type || "unknown",
        totalCount,
        projects: sources,
        confidence: totalCount,
        first_seen: firstSeen,
        last_seen: lastSeen,
        examples: mature?.examples || [],
        promotedAt: now
      });
      promotedCount++;
    }
  }
  const globalList = [...globalMap.values()].sort((a, b) => b.totalCount - a.totalCount);
  if (globalList.length > 0) {
    atomicWriteJSON(globalPath, globalList);
  }
  return promotedCount;
}
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 100);
}
function promoteToRule(instinct, claudeDir) {
  const rulesDir = join(claudeDir, "rules", "archive");
  if (!existsSync(rulesDir)) mkdirSync(rulesDir, { recursive: true });
  const safeName = sanitizeFilename(instinct.pattern);
  const fileName = `learned-${safeName}.md`;
  const filePath = join(rulesDir, fileName);
  if (!filePath.startsWith(rulesDir)) return;
  if (existsSync(filePath)) return;
  const content = `# Learned: ${instinct.pattern}

> Bu kural otomatik olusturuldu (${instinct.count} tekrar, ${instinct.type} tipi).

## Pattern
${instinct.pattern}

## Ornekler
${instinct.examples.map((e) => `- ${e}`).join("\n")}

## Ilk gorulme
${instinct.first_seen}

## Son gorulme
${instinct.last_seen}
`;
  writeFileSync(filePath, content, { mode: 384 });
  const logPath = join(claudeDir, "learning-log.txt");
  const logLine = `[${(/* @__PURE__ */ new Date()).toISOString()}] PROMOTED: ${instinct.pattern} (${instinct.count} occurrences) \u2192 ${fileName}
`;
  appendFileSync(logPath, logLine);
}
main();
