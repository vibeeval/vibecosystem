// src/credential-deny.ts
import { readFileSync, realpathSync, lstatSync, readlinkSync } from "fs";
import { resolve, dirname, isAbsolute, relative } from "path";
import { homedir as homedir2 } from "os";

// src/shared/hook-health.ts
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var HEALTH_FILE = join(homedir(), ".claude", "hook-health.jsonl");
function reportHealth(hookName, success, durationMs, error) {
  try {
    const entry = {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      hook: hookName,
      success,
      duration_ms: Math.round(durationMs)
    };
    if (error) entry.error = error.slice(0, 200);
    mkdirSync(join(homedir(), ".claude"), { recursive: true });
    appendFileSync(HEALTH_FILE, JSON.stringify(entry) + "\n", { mode: 384 });
  } catch {
  }
}

// src/credential-deny.ts
var HOME = homedir2().replace(/\\/g, "/");
var DENIED_PATHS = [
  { pattern: /[/\\]\.ssh(?:[/\\]|$)/, reason: "SSH keys" },
  { pattern: /[/\\]\.aws(?:[/\\]|$)/, reason: "AWS credentials" },
  { pattern: /[/\\]\.kube(?:[/\\]|$)/, reason: "Kubernetes config" },
  { pattern: /[/\\]\.gnupg(?:[/\\]|$)/, reason: "GPG keys" },
  { pattern: /[/\\]\.npmrc$/, reason: "NPM tokens" },
  { pattern: /[/\\]\.pypirc$/, reason: "PyPI tokens" },
  { pattern: /[/\\]\.docker[/\\]config\.json$/, reason: "Docker credentials" },
  { pattern: /[/\\]\.netrc$/, reason: "Network credentials" },
  { pattern: /[/\\]credentials\.json$/, reason: "Credential file" },
  { pattern: /[/\\]service[-_]?account.*\.json$/i, reason: "Service account key" },
  { pattern: /[/\\]\.env$/, reason: "Environment secrets" },
  { pattern: /[/\\]\.env\.[\w.]+$/, reason: "Environment secrets" },
  { pattern: /[/\\]id_rsa$/, reason: "Private SSH key" },
  { pattern: /[/\\]id_ed25519$/, reason: "Private SSH key" },
  { pattern: /[/\\]id_ecdsa$/, reason: "Private SSH key" },
  { pattern: /terraform\.tfstate$/i, reason: "Terraform state (may contain secrets)" },
  { pattern: /[/\\]\.git[/\\]config$/, reason: "Git config (may contain credential helpers)" },
  { pattern: /[/\\]\.password-store(?:[/\\]|$)/, reason: "Password store" }
];
var SENSITIVE_ENV_VARS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "DB_PASSWORD",
  "SECRET_KEY",
  "PRIVATE_KEY",
  "NPM_TOKEN",
  "PYPI_TOKEN"
];
var SENSITIVE_KEYWORDS = [
  { pattern: /\.ssh\b/, reason: "SSH directory reference" },
  { pattern: /\.aws\b/, reason: "AWS directory reference" },
  { pattern: /\.kube\b/, reason: "Kubernetes directory reference" },
  { pattern: /\.gnupg\b/, reason: "GPG directory reference" },
  { pattern: /\bid_rsa\b/, reason: "SSH private key reference" },
  { pattern: /\bid_ed25519\b/, reason: "SSH private key reference" },
  { pattern: /\bid_ecdsa\b/, reason: "SSH private key reference" }
];
function resolveAllPaths(filePath, cwd = process.cwd()) {
  const expanded = filePath.replace(/^~(?=\/|$)/, HOME).replace(/^\$(?:HOME|\{HOME\})(?=\/|$)/, HOME);
  const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
  const paths = /* @__PURE__ */ new Set([filePath, absolute]);
  filePath = absolute;
  try {
    const stat = lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(filePath);
      const abs = target.startsWith("/") ? target : resolve(dirname(filePath), target);
      paths.add(abs);
    }
  } catch {
  }
  try {
    paths.add(realpathSync(filePath));
  } catch {
    let ancestor = dirname(absolute);
    while (true) {
      try {
        paths.add(resolve(realpathSync(ancestor), relative(ancestor, absolute)));
        break;
      } catch {
        try {
          if (lstatSync(ancestor).isSymbolicLink()) {
            paths.add(resolve(dirname(ancestor), readlinkSync(ancestor), relative(ancestor, absolute)));
            break;
          }
        } catch {
        }
      }
      const parent = dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
  }
  return [...paths];
}
function checkFilePath(filePath, cwd = process.cwd()) {
  for (const path of [filePath, resolve(cwd, filePath)]) {
    const direct = path.replace(/\\/g, "/");
    const match = DENIED_PATHS.find((deny) => deny.pattern.test(direct));
    if (match) return match.reason;
  }
  const candidates = resolveAllPaths(filePath, cwd).map((p) => p.replace(/\\/g, "/"));
  for (const normalized of candidates) {
    for (const deny of DENIED_PATHS) {
      if (deny.pattern.test(normalized)) {
        return deny.reason;
      }
    }
  }
  return null;
}
function extractPaths(cmd) {
  const paths = [];
  let m;
  const absRegex = /(?:^|\s|[<>=|"'])(~?\/[^\s;|&><"']+)/g;
  while ((m = absRegex.exec(cmd)) !== null) {
    let p = m[1].trim();
    if (p.startsWith("~")) p = HOME + p.slice(1);
    paths.push(p);
  }
  const relRegex = /(?:^|\s)(\.{1,2}\/[^\s;|&><"']+)/g;
  while ((m = relRegex.exec(cmd)) !== null) {
    paths.push(m[1]);
  }
  const bareRegex = /(?:^|\s)(\.(?:ssh|aws|kube|gnupg|env|npmrc|pypirc|netrc)\b[^\s;|&><"']*)/g;
  while ((m = bareRegex.exec(cmd)) !== null) {
    paths.push(m[1]);
  }
  const homeVarRegex = /\$(?:HOME|\{HOME\})(\/[^\s;|&><"']+)/g;
  while ((m = homeVarRegex.exec(cmd)) !== null) {
    paths.push(HOME + m[1]);
  }
  const quotedRegex = /['"](\/?[^'"]*(?:\.ssh|\.aws|\.kube|\.gnupg|\.env|credentials|id_rsa|id_ed25519|\.npmrc|\.pypirc|\.netrc)[^'"]*)['"]/gi;
  while ((m = quotedRegex.exec(cmd)) !== null) {
    paths.push(m[1]);
  }
  const tokens = cmd.match(/(?:[^\s;|&<>"'\\]|\\.|"(?:[^"\\]|\\.)*"|'[^']*')+/g) || [];
  for (const token of tokens) {
    const literal = token.replace(/\\(.)/g, "$1").replace(/["']/g, "");
    const value = literal.startsWith("--") && literal.includes("=") ? literal.slice(literal.indexOf("=") + 1) : literal;
    if (value.includes("/") || /^(?:\.env(?:\.|$)|\.npmrc$|\.pypirc$|\.netrc$|credentials\.json$|service[-_]?account.*\.json$|terraform\.tfstate$)/i.test(value)) {
      paths.push(value);
    }
  }
  return [...new Set(paths)];
}
function checkBashCommand(cmd, cwd = process.cwd()) {
  const commands = cmd.split(/[;|&\n]+/).map((part) => part.trim());
  for (let command of commands) {
    command = command.replace(/^(?:(?:command|builtin|sudo)\s+)+/, "").replace(/^\/(?:usr\/)?bin\//, "");
    if (/^(?:env|printenv|set)(?:\s*(?:$|[<>]))/.test(command) || /^(?:env|printenv)\s+(?:-[^\s]+\s*)*(?:$|[<>])/.test(command) || /^export\s+-p(?:\s|$)/.test(command)) {
      return "Env dump tum secret'lari ifsa eder";
    }
    const envRead = command.match(/^printenv\s+(.+)/);
    if (envRead && envRead[1].split(/\s+/).some((name) => SENSITIVE_ENV_VARS.includes(name.replace(/["']/g, "")))) {
      return "Hassas env var erisimi: printenv";
    }
  }
  for (const v of SENSITIVE_ENV_VARS) {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\$\\{?${escaped}\\}?`).test(cmd)) {
      return `Hassas env var erisimi: ${v}`;
    }
  }
  for (const kw of SENSITIVE_KEYWORDS) {
    if (kw.pattern.test(cmd)) {
      return `${kw.reason} (bash komutu ile)`;
    }
  }
  const paths = extractPaths(cmd);
  for (const p of paths) {
    const reason = checkFilePath(p, cwd);
    if (reason) return `${reason} (bash komutu ile)`;
  }
  return null;
}
function block(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `ENGELLENDI: ${reason}. Credential guardrail.`
    }
  }));
}
function main() {
  const start = Date.now();
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
    if (!input || typeof input !== "object" || typeof input.tool_name !== "string" || !input.tool_input || typeof input.tool_input !== "object" || Array.isArray(input.tool_input)) {
      throw new Error("Invalid hook input");
    }
  } catch {
    block("Malformed hook input - fail closed");
    reportHealth("credential-deny", true, Date.now() - start);
    return;
  }
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  let blocked = false;
  if (["file_path", "path", "pattern", "command"].some((key) => key in input.tool_input && typeof input.tool_input[key] !== "string")) {
    block("Malformed tool parameters - fail closed");
    reportHealth("credential-deny", true, Date.now() - start);
    return;
  }
  if (["Read", "Edit", "Write"].includes(input.tool_name) && input.tool_input?.file_path) {
    const reason = checkFilePath(input.tool_input.file_path, cwd);
    if (reason) {
      block(`${reason} dosyasina erisim yasak`);
      blocked = true;
    }
  }
  if (!blocked && input.tool_name === "Bash" && input.tool_input?.command) {
    const reason = checkBashCommand(input.tool_input.command, cwd);
    if (reason) {
      block(reason);
      blocked = true;
    }
  }
  if (!blocked && input.tool_name === "Grep" && input.tool_input?.path) {
    const searchPath = input.tool_input.path;
    const reason = checkFilePath(searchPath + "/", cwd) || checkFilePath(searchPath, cwd);
    if (reason) {
      block(`${reason} - Grep ile erisim yasak`);
      blocked = true;
    }
  }
  if (!blocked && input.tool_name === "Glob") {
    const globPath = input.tool_input?.path || "";
    const globPattern = input.tool_input?.pattern || "";
    const fullPath = globPath ? `${globPath}/${globPattern}` : globPattern;
    const reason = checkFilePath(fullPath + "/", cwd) || checkFilePath(fullPath, cwd);
    if (reason) {
      block(`${reason} - Glob ile erisim yasak`);
      blocked = true;
    }
  }
  if (!blocked) console.log("{}");
  reportHealth("credential-deny", true, Date.now() - start);
}
main();
export {
  checkBashCommand,
  checkFilePath,
  extractPaths,
  resolveAllPaths
};
