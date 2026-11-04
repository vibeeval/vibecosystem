/**
 * MCP Auto-Discovery - PreToolUse hook (Read tool icin)
 * Session basinda proje tipine gore MCP server onerir.
 * Sadece 1 kez calisir (session basinda ilk Read'de).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'node:crypto';
import { readHookInput } from './shared/hook-input.js';
import { budgetHookOutput } from './shared/context-budget.js';

interface ToolEvent {
  cwd?: string;
  session_id: string;
  hook_event_name?: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

interface McpMapping {
  name: string;
  signals: string[];
  description: string;
  install: string;
}

const MCP_MAPPINGS: McpMapping[] = [
  {
    name: 'browser-use',
    signals: ['next.config.js', 'next.config.ts', 'next.config.mjs', 'vite.config.ts', 'vite.config.js'],
    description: 'Frontend debug & browser automation',
    install: 'pip3 install --user --break-system-packages browser-use',
  },
  {
    name: 'github',
    signals: ['.github'],
    description: 'GitHub API - repos, issues, PRs',
    install: 'npx -y @modelcontextprotocol/server-github',
  },
  {
    name: 'docker',
    signals: ['docker-compose.yml', 'docker-compose.yaml'],
    description: 'Docker container management',
    install: 'npx -y @modelcontextprotocol/server-docker',
  },
  {
    name: 'postgres',
    signals: ['schema.prisma', 'migrations'],
    description: 'PostgreSQL database access',
    install: 'npx -y @modelcontextprotocol/server-postgres',
  },
  {
    name: 'kubernetes',
    signals: ['k8s', 'kubernetes', 'kustomization.yaml'],
    description: 'Kubernetes cluster management',
    install: 'npx -y @modelcontextprotocol/server-kubernetes',
  },
  {
    name: 'codebase-memory',
    signals: ['docs', 'documentation'],
    description: 'Codebase indexing & semantic search',
    install: 'Zaten kurulu: ~/bin/codebase-memory-mcp',
  },
  {
    name: 'sqlite',
    signals: [],
    description: 'SQLite database access',
    install: 'npx -y @modelcontextprotocol/server-sqlite',
  },
  {
    name: 'puppeteer',
    signals: ['playwright.config.ts', 'playwright.config.js', 'cypress.config.ts', 'cypress.config.js'],
    description: 'Browser automation & testing',
    install: 'npx -y @modelcontextprotocol/server-puppeteer',
  },
];

function stateFile(sessionId: string, projectDir: string): string {
  const key = createHash('sha256').update(`${sessionId}\0${projectDir}`).digest('hex').slice(0, 24);
  return join(homedir(), '.claude', 'cache', `mcp-discovery-${key}.json`);
}

function hasAlreadyFired(sessionId: string, projectDir: string): boolean {
  const path = stateFile(sessionId, projectDir);
  if (!existsSync(path)) return false;
  try {
    const state = JSON.parse(readFileSync(path, 'utf-8'));
    return state.session === sessionId;
  } catch {
    return false;
  }
}

function markFired(sessionId: string, projectDir: string): void {
  const cacheDir = join(homedir(), '.claude', 'cache');
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  writeFileSync(stateFile(sessionId, projectDir), JSON.stringify({ session: sessionId, ts: new Date().toISOString() }));
}

function getInstalledMcps(): Set<string> {
  const mcpConfigPath = join(homedir(), '.mcp.json');
  if (!existsSync(mcpConfigPath)) return new Set();
  try {
    const config = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
    return new Set(Object.keys(config.mcpServers || {}));
  } catch {
    return new Set();
  }
}

function discoverMcps(projectDir: string): McpMapping[] {
  const found: McpMapping[] = [];
  const installed = getInstalledMcps();

  for (const mapping of MCP_MAPPINGS) {
    // Zaten kuruluysa onerme
    if (installed.has(mapping.name)) continue;

    for (const signal of mapping.signals) {
      const checkPath = join(projectDir, signal);
      if (existsSync(checkPath)) {
        found.push(mapping);
        break;
      }
    }
  }

  // .sql dosyalari icin ozel kontrol
  if (!installed.has('postgres')) {
    try {
      const files = readdirSync(projectDir);
      if (files.some((f: string) => f.endsWith('.sql'))) {
        const pgMapping = MCP_MAPPINGS.find(m => m.name === 'postgres');
        if (pgMapping && !found.includes(pgMapping)) {
          found.push(pgMapping);
        }
      }
    } catch { /* dizin okunamazsa atla */ }
  }

  // .db/.sqlite dosyalari icin kontrol
  if (!installed.has('sqlite')) {
    try {
      const files = readdirSync(projectDir);
      if (files.some((f: string) => f.endsWith('.db') || f.endsWith('.sqlite'))) {
        const sqliteMapping = MCP_MAPPINGS.find(m => m.name === 'sqlite');
        if (sqliteMapping && !found.includes(sqliteMapping)) {
          found.push(sqliteMapping);
        }
      }
    } catch { /* dizin okunamazsa atla */ }
  }

  return found;
}

function main() {
  let input: ToolEvent;
  try { input = readHookInput<ToolEvent>(); } catch { console.log('{}'); return; }

  // Sadece Read tool'unda tetiklen
  if (input.tool_name !== 'Read') {
    console.log('{}');
    return;
  }

  // Session basina 1 kez calis
  const sessionId = input.session_id || 'unknown';
  const projectDir = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (hasAlreadyFired(sessionId, projectDir)) {
    console.log('{}');
    return;
  }

  const recommendations = discoverMcps(projectDir);

  // Bir sey bulamadiysa sessiz kal
  if (recommendations.length === 0) {
    markFired(sessionId, projectDir);
    console.log('{}');
    return;
  }

  markFired(sessionId, projectDir);

  const lines = [
    '',
    '--- MCP Auto-Discovery ---',
    `Proje: ${projectDir}`,
    '',
    'Bu proje icin faydali olabilecek MCP server\'lar:',
    '',
  ];

  for (const rec of recommendations) {
    lines.push(`  * ${rec.name}: ${rec.description}`);
    lines.push(`    Kurulum: ${rec.install}`);
    lines.push('');
  }

  lines.push('~/.mcp.json dosyasina ekleyerek aktive edebilirsiniz.');
  lines.push('---');

  console.log(JSON.stringify(budgetHookOutput({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: lines.join('\n') },
  }, 'mcp-discovery', 'PreToolUse:Read')));
}

main();
