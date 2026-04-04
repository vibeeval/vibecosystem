// src/magic-doc-tracker.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var MAGIC_DOC_DIR = join(homedir(), ".claude", "magic-docs");
var TRACKED_FILE = join(MAGIC_DOC_DIR, "tracked.json");
var MAGIC_DOC_PATTERN = /^#\s*MAGIC\s+DOC:\s*(.+)$/im;
var INSTRUCTIONS_PATTERN = /^[_*](.+?)[_*]\s*$/m;
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function loadTracked() {
  try {
    if (existsSync(TRACKED_FILE)) {
      return JSON.parse(readFileSync(TRACKED_FILE, "utf-8"));
    }
  } catch {
  }
  return {};
}
function saveTracked(tracked) {
  ensureDir(MAGIC_DOC_DIR);
  writeFileSync(TRACKED_FILE, JSON.stringify(tracked, null, 2), "utf-8");
}
function main() {
  try {
    const input = JSON.parse(process.argv[2] || "{}");
    if (input.tool_name !== "Read") return;
    const filePath = input.tool_input?.file_path;
    const output = input.tool_output || "";
    if (!filePath || !output) return;
    const match = output.match(MAGIC_DOC_PATTERN);
    if (!match || !match[1]) return;
    const title = match[1].trim();
    let instructions;
    const afterHeader = output.substring((match.index || 0) + match[0].length);
    const instrMatch = afterHeader.match(INSTRUCTIONS_PATTERN);
    if (instrMatch && instrMatch[1]) {
      instructions = instrMatch[1].trim();
    }
    const tracked = loadTracked();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    tracked[filePath] = {
      path: filePath,
      title,
      instructions,
      firstSeen: tracked[filePath]?.firstSeen || now,
      lastSeen: now
    };
    saveTracked(tracked);
    const result = {
      additionalContext: `[Magic Doc detected: "${title}" at ${filePath}. Will be auto-updated at session end.]`
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
  }
}
main();
