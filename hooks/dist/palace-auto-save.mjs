// src/shared/hook-response.ts
function responseText(value) {
  if (value === void 0 || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(responseText).filter(Boolean).join("\n");
  if (typeof value !== "object") return String(value);
  const object = value;
  if ("stdout" in object || "stderr" in object) {
    return [object.stdout, object.stderr].map(responseText).filter(Boolean).join("\n");
  }
  if ("text" in object) return responseText(object.text);
  if ("content" in object) return responseText(object.content);
  if ("file" in object) return responseText(object.file);
  if (object.type === "image" || object.type === "image_url") return "";
  return JSON.stringify(value);
}
function hookResponseText(input) {
  return responseText(input.tool_response !== void 0 ? input.tool_response : input.tool_output);
}

// src/palace-auto-save.ts
import { readFileSync as readFileSync2, writeFileSync, appendFileSync, existsSync as existsSync2, mkdirSync } from "node:fs";
import { join as join2, resolve as resolve2, sep } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

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
function sanitizeProjectName(name) {
  if (!name || typeof name !== "string") return "default";
  const stripped = name.replace(/^@[^/]+\//, "");
  const safe = stripped.replace(/[^a-zA-Z0-9_\-.]/g, "_").slice(0, 64);
  const result = safe.replace(/^\.+/, "").replace(/\.+$/, "");
  return result || "default";
}
function getSafeProjectName() {
  try {
    const identity = getProjectIdentity();
    if (identity?.name) return sanitizeProjectName(identity.name);
  } catch {
  }
  try {
    const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    return sanitizeProjectName(basename(dir));
  } catch {
    return "default";
  }
}

// src/palace-auto-save.ts
var PALACE_DIR = join2(homedir(), ".claude", "palace");
var ROOM_KEYWORDS = {
  authentication: ["auth", "login", "jwt", "oauth", "session", "token", "password", "credential"],
  database: ["database", "sql", "migration", "schema", "query", "postgres", "mysql", "mongo", "redis"],
  deployment: ["deploy", "ci/cd", "docker", "kubernetes", "k8s", "vercel", "aws", "pipeline"],
  frontend: ["react", "css", "component", "ui", "ux", "tailwind", "next.js", "vue", "svelte"],
  api: ["api", "endpoint", "rest", "graphql", "grpc", "route", "handler", "middleware"],
  testing: ["test", "tdd", "coverage", "mock", "fixture", "assertion", "vitest", "jest", "playwright"],
  security: ["security", "xss", "injection", "cors", "csrf", "vulnerability", "audit"],
  performance: ["performance", "cache", "optimize", "latency", "bundle", "lazy", "profil"],
  configuration: ["config", "env", "settings", "dotenv", "yaml", "toml"],
  architecture: ["architect", "design", "pattern", "refactor", "structure", "module", "layer"]
};
function detectRoom(content) {
  const lower = content.toLowerCase();
  let bestRoom = "general";
  let bestScore = 0;
  for (const [room, keywords] of Object.entries(ROOM_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestRoom = room;
    }
  }
  return bestRoom;
}
function detectType(content) {
  const lower = content.toLowerCase();
  if (lower.includes("chose") || lower.includes("decided") || lower.includes("selected") || lower.includes("picked")) return "decision";
  if (lower.includes("error") || lower.includes("fix") || lower.includes("bug") || lower.includes("resolved")) return "error";
  if (lower.includes("must") || lower.includes("required") || lower.includes("constraint") || lower.includes("limit")) return "constraint";
  if (lower.includes("pattern") || lower.includes("always") || lower.includes("convention")) return "pattern";
  return "discovery";
}
function generateId() {
  return "d-" + randomUUID().slice(0, 12);
}
function isSignificantOutput(output) {
  if (!output || output.length < 100) return false;
  const markers = [
    "decided",
    "chose",
    "architecture",
    "because",
    "reason:",
    "conclusion",
    "error:",
    "fixed",
    "resolved",
    "constraint",
    "requirement",
    "pattern"
  ];
  const lower = output.toLowerCase();
  return markers.some((m) => lower.includes(m));
}
function safePalacePath(filename) {
  const candidate = resolve2(join2(PALACE_DIR, filename));
  const palaceRoot = resolve2(PALACE_DIR);
  if (!candidate.startsWith(palaceRoot + sep) && candidate !== palaceRoot) {
    return null;
  }
  return candidate;
}
function saveToPalace(entry) {
  mkdirSync(PALACE_DIR, { recursive: true });
  const indexPath = join2(PALACE_DIR, "index.json");
  let index = {};
  if (existsSync2(indexPath)) {
    try {
      index = JSON.parse(readFileSync2(indexPath, "utf-8"));
    } catch {
    }
  }
  if (!index[entry.wing]) {
    index[entry.wing] = { rooms: [], lastUpdate: "" };
  }
  if (!index[entry.wing].rooms.includes(entry.room)) {
    index[entry.wing].rooms.push(entry.room);
  }
  index[entry.wing].lastUpdate = entry.timestamp;
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  const wingFile = safePalacePath(`${entry.wing}.jsonl`);
  if (!wingFile) return;
  appendFileSync(wingFile, JSON.stringify(entry) + "\n");
}
function runHook() {
  let input;
  try {
    input = readFileSync2(0, "utf-8");
  } catch {
    return;
  }
  let event;
  try {
    event = JSON.parse(input);
  } catch {
    return;
  }
  if (event.tool_name !== "Agent") {
    return;
  }
  const output = hookResponseText(event);
  if (!isSignificantOutput(output)) {
    return;
  }
  const wing = getSafeProjectName();
  const room = detectRoom(output);
  const type = detectType(output);
  const agentType = String(event.tool_input?.subagent_type || "unknown");
  const sentences = output.split(/[.!?\n]/).filter((s) => s.trim().length > 20);
  const content = sentences.slice(0, 2).join(". ").slice(0, 200);
  if (!content) return;
  const entry = {
    id: generateId(),
    wing,
    room,
    content,
    tags: [room, type, agentType],
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    session_id: event.session_id || "unknown",
    agent: agentType,
    type
  };
  try {
    saveToPalace(entry);
  } catch {
  }
}
try {
  runHook();
} catch {
  process.exit(0);
}
