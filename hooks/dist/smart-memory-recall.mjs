var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/smart-memory-recall.ts
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CLAUDE_HOME = join(homedir(), ".claude");
var MAX_RESULTS = 3;
var MAX_CONTEXT_SIZE = 4e3;
var FRONTMATTER_MAX_BYTES = 2e3;
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "", type: "" };
  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  const typeMatch = fm.match(/^type:\s*(.+)$/m);
  return {
    name: nameMatch?.[1]?.trim() || "",
    description: descMatch?.[1]?.trim() || "",
    type: typeMatch?.[1]?.trim() || ""
  };
}
function scanDir(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (!stat.isFile() || stat.size === 0) continue;
        const fd = __require("fs").openSync(filePath, "r");
        const buf = Buffer.alloc(Math.min(FRONTMATTER_MAX_BYTES, stat.size));
        __require("fs").readSync(fd, buf, 0, buf.length, 0);
        __require("fs").closeSync(fd);
        const content = buf.toString("utf-8");
        const fm = parseFrontmatter(content);
        results.push({
          filename: file,
          filePath,
          name: fm.name || file.replace(".md", ""),
          description: fm.description,
          type: fm.type,
          mtimeMs: stat.mtimeMs,
          score: 0
        });
      } catch {
      }
    }
  } catch {
  }
  return results;
}
function scanAllMemories() {
  const headers = [];
  const projectsDir = join(CLAUDE_HOME, "projects");
  if (existsSync(projectsDir)) {
    try {
      for (const proj of readdirSync(projectsDir)) {
        const memDir = join(projectsDir, proj, "memory");
        headers.push(...scanDir(memDir));
      }
    } catch {
    }
  }
  const agentMemDir = join(CLAUDE_HOME, "agent-memory");
  if (existsSync(agentMemDir)) {
    try {
      for (const agent of readdirSync(agentMemDir)) {
        const dir = join(agentMemDir, agent);
        if (existsSync(dir) && statSync(dir).isDirectory()) {
          headers.push(...scanDir(dir));
        }
      }
    } catch {
    }
  }
  return headers;
}
function scoreMemories(headers, query) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return [];
  for (const header of headers) {
    let score = 0;
    const searchText = `${header.name} ${header.description} ${header.filename} ${header.type}`.toLowerCase();
    for (const word of queryWords) {
      if (searchText.includes(word)) {
        score += 10;
      }
    }
    if (searchText.includes(queryLower.substring(0, 30))) {
      score += 20;
    }
    const filenameLower = header.filename.toLowerCase().replace(".md", "").replace(/[-_]/g, " ");
    for (const word of queryWords) {
      if (filenameLower.includes(word)) {
        score += 15;
      }
    }
    if (header.type === "feedback") score += 5;
    if (header.type === "project") score += 3;
    const ageMs = Date.now() - header.mtimeMs;
    if (ageMs < 7 * 24 * 60 * 60 * 1e3) score += 5;
    else if (ageMs < 30 * 24 * 60 * 60 * 1e3) score += 2;
    header.score = score;
  }
  return headers.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
function loadMemoryContents(selected) {
  const parts = [];
  let totalSize = 0;
  for (const mem of selected) {
    try {
      let content = readFileSync(mem.filePath, "utf-8").trim();
      if (totalSize + content.length > MAX_CONTEXT_SIZE) {
        const remaining = MAX_CONTEXT_SIZE - totalSize;
        if (remaining < 200) break;
        content = content.substring(0, remaining) + "\n[... truncated]";
      }
      parts.push(`### ${mem.name} (${mem.type || "unknown"}, score: ${mem.score})
*Source: ${mem.filename}*

${content}`);
      totalSize += content.length;
    } catch {
    }
  }
  return parts.join("\n\n---\n\n");
}
function readStdin() {
  return readFileSync(0, "utf-8");
}
async function main() {
  const input = JSON.parse(readStdin());
  if (process.env.CLAUDE_AGENT_ID) return;
  if (input.prompt.length < 15) return;
  if (input.prompt.trim().startsWith("/")) return;
  const allHeaders = scanAllMemories();
  if (allHeaders.length === 0) return;
  const selected = scoreMemories(allHeaders, input.prompt);
  if (selected.length === 0) return;
  const contents = loadMemoryContents(selected);
  if (!contents) return;
  const context = `## Smart Memory Recall (${selected.length} relevant memories found)

${contents}

---
*Memory recall otomatik. Alakali icerik varsa kullan, yoksa yok say.*`;
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context
    }
  }));
}
main().catch(() => {
});
