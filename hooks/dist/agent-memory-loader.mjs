// src/agent-memory-loader.ts
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CLAUDE_HOME = join(homedir(), ".claude");
var MAX_MEMORY_SIZE = 8e3;
var MAX_FILES = 10;
function sanitizeAgentType(agentType) {
  return agentType.replace(/[:/\\]/g, "-").replace(/\s+/g, "-").toLowerCase();
}
function getAgentMemoryDir(agentType, scope) {
  const dirName = sanitizeAgentType(agentType);
  switch (scope) {
    case "user":
      return join(CLAUDE_HOME, "agent-memory", dirName);
    case "project":
      return join(process.cwd(), ".claude", "agent-memory", dirName);
    case "local":
      return join(process.cwd(), ".claude", "agent-memory-local", dirName);
  }
}
function scanMemoryDir(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).slice(0, MAX_FILES);
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (stat.isFile() && stat.size > 0 && stat.size < 5e4) {
          const content = readFileSync(filePath, "utf-8").trim();
          if (content) {
            results.push(`### ${file}
${content}`);
          }
        }
      } catch {
      }
    }
  } catch {
  }
  return results;
}
function getAgentMemoryScope(agentType) {
  const agentDir = join(CLAUDE_HOME, "agents");
  const agentFile = join(agentDir, `${agentType}.md`);
  if (!existsSync(agentFile)) return void 0;
  try {
    const content = readFileSync(agentFile, "utf-8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return void 0;
    const memoryMatch = frontmatterMatch[1].match(/^memory:\s*(.+)$/m);
    if (!memoryMatch) return void 0;
    const scope = memoryMatch[1].trim().toLowerCase();
    if (scope === "user" || scope === "project" || scope === "local") {
      return scope;
    }
  } catch {
  }
  return void 0;
}
function main() {
  try {
    const input = JSON.parse(process.argv[2] || "{}");
    if (input.tool_name !== "Agent") return;
    const agentType = input.tool_input?.subagent_type;
    if (!agentType) return;
    const scope = getAgentMemoryScope(agentType);
    const effectiveScope = scope || "user";
    const memoryDir = getAgentMemoryDir(agentType, effectiveScope);
    const memories = scanMemoryDir(memoryDir);
    if (memories.length === 0) return;
    let combined = memories.join("\n\n");
    if (combined.length > MAX_MEMORY_SIZE) {
      combined = combined.substring(0, MAX_MEMORY_SIZE) + "\n\n[... truncated]";
    }
    const context = `## Agent Persistent Memory (${agentType}, scope: ${effectiveScope})

Bu agent'in onceki session'lardan biriktirdigi kalici bellek:

${combined}

---
Bu memory'yi guncelle: Yeni ogrenimler varsa ~/.claude/agent-memory/${sanitizeAgentType(agentType)}/ dizinine yaz.
Memory guncelleme zorunlu DEGiL - sadece gercekten yeni ve degerli bilgi varsa kaydet.`;
    const result = {
      additionalContext: context
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
  }
}
main();
