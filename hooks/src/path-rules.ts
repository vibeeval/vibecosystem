/**
 * Path-based rule injection hook
 *
 * Fires on PreToolUse for Read/Edit/Write
 * Matches file paths against patterns and injects relevant skill content
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'node:os';
import { readHookInput } from './shared/hook-input.js';
import { budgetContext } from './shared/context-budget.js';

interface HookInput {
  session_id: string;
  hook_event_name: string;
  tool_name: string;
  tool_input: {
    file_path?: string;
  };
}

interface PathRule {
  pattern: RegExp;
  skillName: string;
  description: string;
}

// Path patterns → skill mappings
const PATH_RULES: PathRule[] = [
  // Hook development
  { pattern: /\.claude\/hooks\//, skillName: 'hooks', description: 'Hook development' },

  // Skill development
  { pattern: /\.claude\/skills\//, skillName: 'skill-development', description: 'Skill development' },

  // Agent cache
  { pattern: /\.claude\/cache\/agents\//, skillName: 'agent-context-isolation', description: 'Agent context isolation' },

  // Continuity ledgers
  { pattern: /thoughts\/ledgers\/CONTINUITY_CLAUDE-/, skillName: 'continuity', description: 'Continuity ledger' },

  // Agentica
  { pattern: /opc\/scripts\/agentica/, skillName: 'async-repl-protocol', description: 'Agentica REPL protocol' },

  // MCP scripts
  { pattern: /scripts\/.*\.py$/, skillName: 'mcp-scripts', description: 'MCP scripts' },

  // Lean files
  { pattern: /\.lean$/, skillName: 'llm-tuning-patterns', description: 'LLM tuning for proofs' },

  // Skill rules config
  { pattern: /skill-rules\.json$/, skillName: 'router-first-architecture', description: 'Router-first architecture' },

  // Wiring/hooks infrastructure
  { pattern: /\.claude\/settings\.json$/, skillName: 'wiring', description: 'Wiring verification' },
];

function getProjectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function loadSkillContent(skillName: string): string | null {
  const projectDir = getProjectDir();
  const skillPath = [projectDir, homedir()]
    .map(root => join(root, '.claude', 'skills', skillName, 'SKILL.md'))
    .find(file => existsSync(file));
  if (!skillPath) return null;

  try {
    return readFileSync(skillPath, 'utf-8')
      .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim();
  } catch {
    return null;
  }
}

function getMatchingSkills(filePath: string): string[] {
  const matched: string[] = [];
  for (const rule of PATH_RULES) {
    if (rule.pattern.test(filePath)) {
      matched.push(rule.skillName);
    }
  }
  return matched;
}

async function main() {
  const input = readHookInput() as unknown as HookInput;
  const filePath = input.tool_input?.file_path;

  if (!filePath) {
    console.log('{}');
    return;
  }

  const skills = getMatchingSkills(filePath);
  if (skills.length === 0) {
    console.log('{}');
    return;
  }

  const contents: string[] = [];
  for (const skill of skills) {
    const content = loadSkillContent(skill);
    if (content) contents.push(content);
  }

  if (contents.length === 0) {
    console.log('{}');
    return;
  }

  const context = budgetContext('path-rules', 'PreToolUse', contents.join('\n\n---\n\n'), { deduplicate: 'session' });
  console.log(JSON.stringify(context ? {
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: context }
  } : {}));
}

main().catch(() => process.exit(1));
