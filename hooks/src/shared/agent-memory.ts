import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export type AgentMemoryScope = 'user' | 'project' | 'local';

/** One safe path component; reject dot paths before consulting agent metadata. */
export function sanitizeAgentType(agentType: string): string {
  return agentType.replace(/[:/\\\s]+/g, '-').replace(/[^a-zA-Z0-9_.-]/g, '')
    .replace(/^\.+|\.+$/g, '').toLowerCase() || 'unknown';
}

export function agentProjectDir(cwd?: string): string {
  return resolve(cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

export function getAgentMemoryScope(agentType: string, cwd?: string): AgentMemoryScope {
  // Agent metadata itself must stay inside the agents directory.
  if (!/^[a-zA-Z0-9_:-]+$/.test(agentType)) return 'user';
  const files = [
    join(agentProjectDir(cwd), '.claude', 'agents', `${agentType}.md`),
    join(homedir(), '.claude', 'agents', `${agentType}.md`),
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const frontmatter = readFileSync(file, 'utf-8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const scope = frontmatter?.[1].match(/^memory:\s*['"]?(user|project|local)['"]?\s*$/m)?.[1];
      if (scope) return scope as AgentMemoryScope;
    } catch { /* Try the next agent definition. */ }
  }
  return 'user';
}

export function getAgentMemoryDir(agentType: string, scope: AgentMemoryScope, cwd?: string): string {
  const name = sanitizeAgentType(agentType);
  if (scope === 'user') return join(homedir(), '.claude', 'agent-memory', name);
  return join(agentProjectDir(cwd), '.claude', scope === 'local' ? 'agent-memory-local' : 'agent-memory', name);
}
