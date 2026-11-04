/**
 * palace-auto-save.ts - Memory Palace Auto-Save Hook
 *
 * PostToolUse hook that detects important decisions, discoveries,
 * and constraints from agent outputs and saves them to the palace.
 *
 * Triggers on: Agent tool completions with significant output
 * Saves to: ~/.claude/palace/{project}.jsonl
 */

import { hookResponseText } from './shared/hook-response.js';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { getSafeProjectName } from './shared/project-identity.js';

interface ToolEvent {
  tool_name: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  tool_response?: unknown;
  session_id?: string;
}

interface PalaceEntry {
  id: string;
  wing: string;
  room: string;
  content: string;
  tags: string[];
  timestamp: string;
  session_id: string;
  agent: string;
  type: 'decision' | 'discovery' | 'error' | 'constraint' | 'pattern';
}

const PALACE_DIR = join(homedir(), '.claude', 'palace');

const ROOM_KEYWORDS: Record<string, string[]> = {
  authentication: ['auth', 'login', 'jwt', 'oauth', 'session', 'token', 'password', 'credential'],
  database: ['database', 'sql', 'migration', 'schema', 'query', 'postgres', 'mysql', 'mongo', 'redis'],
  deployment: ['deploy', 'ci/cd', 'docker', 'kubernetes', 'k8s', 'vercel', 'aws', 'pipeline'],
  frontend: ['react', 'css', 'component', 'ui', 'ux', 'tailwind', 'next.js', 'vue', 'svelte'],
  api: ['api', 'endpoint', 'rest', 'graphql', 'grpc', 'route', 'handler', 'middleware'],
  testing: ['test', 'tdd', 'coverage', 'mock', 'fixture', 'assertion', 'vitest', 'jest', 'playwright'],
  security: ['security', 'xss', 'injection', 'cors', 'csrf', 'vulnerability', 'audit'],
  performance: ['performance', 'cache', 'optimize', 'latency', 'bundle', 'lazy', 'profil'],
  configuration: ['config', 'env', 'settings', 'dotenv', 'yaml', 'toml'],
  architecture: ['architect', 'design', 'pattern', 'refactor', 'structure', 'module', 'layer'],
};

function detectRoom(content: string): string {
  const lower = content.toLowerCase();
  let bestRoom = 'general';
  let bestScore = 0;

  for (const [room, keywords] of Object.entries(ROOM_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    // Require at least 2 keyword matches to avoid false positives
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestRoom = room;
    }
  }

  return bestRoom;
}

function detectType(content: string): PalaceEntry['type'] {
  const lower = content.toLowerCase();
  if (lower.includes('chose') || lower.includes('decided') || lower.includes('selected') || lower.includes('picked')) return 'decision';
  if (lower.includes('error') || lower.includes('fix') || lower.includes('bug') || lower.includes('resolved')) return 'error';
  if (lower.includes('must') || lower.includes('required') || lower.includes('constraint') || lower.includes('limit')) return 'constraint';
  if (lower.includes('pattern') || lower.includes('always') || lower.includes('convention')) return 'pattern';
  return 'discovery';
}

function generateId(): string {
  return 'd-' + randomUUID().slice(0, 12);
}

function isSignificantOutput(output: string): boolean {
  if (!output || output.length < 100) return false;
  const markers = ['decided', 'chose', 'architecture', 'because', 'reason:', 'conclusion',
    'error:', 'fixed', 'resolved', 'constraint', 'requirement', 'pattern'];
  const lower = output.toLowerCase();
  return markers.some(m => lower.includes(m));
}

/**
 * Verify that a constructed path stays within PALACE_DIR.
 * Returns null if the path would escape.
 */
function safePalacePath(filename: string): string | null {
  const candidate = resolve(join(PALACE_DIR, filename));
  const palaceRoot = resolve(PALACE_DIR);
  if (!candidate.startsWith(palaceRoot + sep) && candidate !== palaceRoot) {
    return null;
  }
  return candidate;
}

function saveToPalace(entry: PalaceEntry): void {
  mkdirSync(PALACE_DIR, { recursive: true });

  // Index path (constant, safe)
  const indexPath = join(PALACE_DIR, 'index.json');
  let index: Record<string, { rooms: string[]; lastUpdate: string }> = {};
  if (existsSync(indexPath)) {
    try { index = JSON.parse(readFileSync(indexPath, 'utf-8')); } catch { /* use empty */ }
  }

  if (!index[entry.wing]) {
    index[entry.wing] = { rooms: [], lastUpdate: '' };
  }
  if (!index[entry.wing].rooms.includes(entry.room)) {
    index[entry.wing].rooms.push(entry.room);
  }
  index[entry.wing].lastUpdate = entry.timestamp;
  writeFileSync(indexPath, JSON.stringify(index, null, 2));

  // Append entry - verify path stays inside palace dir
  const wingFile = safePalacePath(`${entry.wing}.jsonl`);
  if (!wingFile) return; // silently drop if path would escape
  appendFileSync(wingFile, JSON.stringify(entry) + '\n');
}

function runHook(): void {
  let input: string;
  try {
    input = readFileSync(0, 'utf-8');
  } catch { return; }

  let event: ToolEvent;
  try {
    event = JSON.parse(input);
  } catch { return; }

  // Only process Agent completions with significant output
  if (event.tool_name !== 'Agent') {
    return;
  }

  const output = hookResponseText(event);
  if (!isSignificantOutput(output)) {
    return;
  }

  const wing = getSafeProjectName();
  const room = detectRoom(output);
  const type = detectType(output);
  const agentType = String(event.tool_input?.subagent_type || 'unknown');

  // Extract first meaningful sentence as content (max 200 chars)
  const sentences = output.split(/[.!?\n]/).filter(s => s.trim().length > 20);
  const content = sentences.slice(0, 2).join('. ').slice(0, 200);

  if (!content) return;

  const entry: PalaceEntry = {
    id: generateId(),
    wing,
    room,
    content,
    tags: [room, type, agentType],
    timestamp: new Date().toISOString(),
    session_id: event.session_id || 'unknown',
    agent: agentType,
    type,
  };

  try { saveToPalace(entry); } catch { /* silent fail */ }
}

try { runHook(); } catch { process.exit(0); }
