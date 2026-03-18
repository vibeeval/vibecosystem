// src/passive-learner.ts
import { readFileSync as readFileSync2, appendFileSync, existsSync as existsSync2, mkdirSync } from "fs";
import { join as join2, extname, basename as basename2 } from "path";
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

// src/passive-learner.ts
var ERROR_FIX_PATTERNS = [
  { error: /Cannot find module ['"](.+?)['"]/i, label: "missing-import" },
  { error: /Property ['"](.+?)['"] does not exist/i, label: "missing-property" },
  { error: /Type ['"](.+?)['"] is not assignable/i, label: "type-mismatch" },
  { error: /ENOENT.*['"](.+?)['"]/i, label: "missing-file" },
  { error: /SyntaxError/i, label: "syntax-error" }
];
function detectFilePattern(filePath) {
  const ext = extname(filePath);
  const name = basename2(filePath);
  if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(name)) {
    return {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      session: "",
      type: "file_pattern",
      pattern: "test-file-creation",
      detail: `Test file: ${name} (${ext})`,
      confidence: 0.5
    };
  }
  if (filePath.includes(".claude/hooks")) {
    return {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      session: "",
      type: "file_pattern",
      pattern: "hook-development",
      detail: `Hook file: ${name}`,
      confidence: 0.5
    };
  }
  return null;
}
function detectEditPattern(oldStr, newStr) {
  if (!oldStr && /^import\s/.test(newStr.trim())) {
    return {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      session: "",
      type: "edit_pattern",
      pattern: "add-import",
      detail: newStr.trim().slice(0, 80),
      confidence: 0.3
    };
  }
  if (newStr.includes("try") && newStr.includes("catch") && !oldStr.includes("try")) {
    return {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      session: "",
      type: "edit_pattern",
      pattern: "add-error-handling",
      detail: "try-catch block added",
      confidence: 0.4
    };
  }
  if (/:\s*(string|number|boolean|Record|Array|Promise)/.test(newStr) && !/:\s*(string|number|boolean|Record|Array|Promise)/.test(oldStr)) {
    return {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      session: "",
      type: "edit_pattern",
      pattern: "add-type-annotation",
      detail: "Type annotation added",
      confidence: 0.3
    };
  }
  return null;
}
function detectErrorFix(output) {
  if (!output) return null;
  for (const { error, label } of ERROR_FIX_PATTERNS) {
    const match = error.exec(output);
    if (match) {
      return {
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        session: "",
        type: "error_fix",
        pattern: label,
        detail: match[0].slice(0, 100),
        confidence: 0.6
      };
    }
  }
  return null;
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
  const instincts = [];
  const sessionId = input.session_id?.slice(0, 8) || "unknown";
  if (input.tool_name === "Edit" && input.tool_input?.file_path) {
    const fileInst = detectFilePattern(input.tool_input.file_path);
    if (fileInst) instincts.push({ ...fileInst, session: sessionId });
    if (input.tool_input.old_string && input.tool_input.new_string) {
      const editInst = detectEditPattern(input.tool_input.old_string, input.tool_input.new_string);
      if (editInst) instincts.push({ ...editInst, session: sessionId });
    }
  }
  if (input.tool_name === "Write" && input.tool_input?.file_path) {
    const fileInst = detectFilePattern(input.tool_input.file_path);
    if (fileInst) instincts.push({ ...fileInst, session: sessionId });
  }
  if (input.tool_name === "Bash" && input.tool_output) {
    const errInst = detectErrorFix(input.tool_output);
    if (errInst) instincts.push({ ...errInst, session: sessionId });
  }
  if (instincts.length > 0) {
    const identity = getProjectIdentity();
    if (identity) {
      for (const inst of instincts) {
        inst.project = identity.hash;
        inst.projectName = identity.name;
      }
    }
    const logDir = join2(homedir(), ".claude");
    if (!existsSync2(logDir)) mkdirSync(logDir, { recursive: true });
    const logPath = join2(logDir, "instincts.jsonl");
    for (const inst of instincts) {
      appendFileSync(logPath, JSON.stringify(inst) + "\n");
    }
  }
  console.log("{}");
}
main();
