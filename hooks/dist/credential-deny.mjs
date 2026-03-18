// src/credential-deny.ts
import { readFileSync } from "fs";
import { homedir } from "os";
var HOME = homedir().replace(/\\/g, "/");
var DENIED_PATHS = [
  { pattern: /[/\\]\.ssh[/\\]/, reason: "SSH keys" },
  { pattern: /[/\\]\.aws[/\\]/, reason: "AWS credentials" },
  { pattern: /[/\\]\.kube[/\\]/, reason: "Kubernetes config" },
  { pattern: /[/\\]\.gnupg[/\\]/, reason: "GPG keys" },
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
  { pattern: /[/\\]\.password-store[/\\]/, reason: "Password store" }
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
function checkFilePath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const deny of DENIED_PATHS) {
    if (deny.pattern.test(normalized)) {
      return deny.reason;
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
  return paths;
}
function checkBashCommand(cmd) {
  if (/^\s*(env|printenv|set)\s*$/.test(cmd) || /^\s*(env|printenv|set)\s*\|/.test(cmd) || /\bexport\s+-p\b/.test(cmd)) {
    return "Env dump tum secret'lari ifsa eder";
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
    const reason = checkFilePath(p);
    if (reason) return `${reason} (bash komutu ile)`;
  }
  return null;
}
function block(reason) {
  console.log(JSON.stringify({
    decision: "block",
    reason: `ENGELLENDI: ${reason}. Guvenlik kurali.`
  }));
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
    block("Malformed hook input - fail closed");
    return;
  }
  if (["Read", "Edit", "Write"].includes(input.tool_name) && input.tool_input?.file_path) {
    const reason = checkFilePath(input.tool_input.file_path);
    if (reason) {
      block(`${reason} dosyasina erisim yasak`);
      return;
    }
  }
  if (input.tool_name === "Bash" && input.tool_input?.command) {
    const reason = checkBashCommand(input.tool_input.command);
    if (reason) {
      block(reason);
      return;
    }
  }
  if (input.tool_name === "Grep" && input.tool_input?.path) {
    const searchPath = input.tool_input.path;
    const reason = checkFilePath(searchPath + "/") || checkFilePath(searchPath);
    if (reason) {
      block(`${reason} - Grep ile erisim yasak`);
      return;
    }
  }
  if (input.tool_name === "Glob") {
    const globPath = input.tool_input?.path || "";
    const globPattern = input.tool_input?.pattern || "";
    const fullPath = globPath ? `${globPath}/${globPattern}` : globPattern;
    const reason = checkFilePath(fullPath + "/") || checkFilePath(fullPath);
    if (reason) {
      block(`${reason} - Glob ile erisim yasak`);
      return;
    }
  }
  console.log("{}");
}
main();
