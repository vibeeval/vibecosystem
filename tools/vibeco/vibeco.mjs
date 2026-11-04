#!/usr/bin/env node
// vibeco - vibecosystem CLI
// Zero dependencies, pure Node.js ESM

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { execFileSync, execSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { get } from 'node:http';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { installClaude } from '../install-runtime.mjs';

const VERSION = '3.5.0';
const CLAUDE_DIR = join(homedir(), '.claude');
const PROFILES_DIR = join(CLAUDE_DIR, 'profiles');
const PLUGIN_CONFIG = join(CLAUDE_DIR, 'plugin-config.json');
const DASHBOARD_PORT = 3848;
const DASHBOARD_SCRIPT = join(CLAUDE_DIR, 'tools', 'dashboard', 'server.js');

// ─── ANSI Colors ───
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};
const green = s => `${c.green}${s}${c.reset}`;
const red = s => `${c.red}${s}${c.reset}`;
const yellow = s => `${c.yellow}${s}${c.reset}`;
const cyan = s => `${c.cyan}${s}${c.reset}`;
const bold = s => `${c.bold}${s}${c.reset}`;
const dim = s => `${c.dim}${s}${c.reset}`;
const magenta = s => `${c.magenta}${s}${c.reset}`;

// ─── Utilities ───
function countFiles(dir, pattern) {
  try {
    const entries = readdirSync(dir);
    if (pattern === 'dir') return entries.filter(e => statSync(join(dir, e)).isDirectory()).length;
    return entries.filter(e => e.endsWith(pattern)).length;
  } catch { return 0; }
}

// parseFrontmatter lives in lib/frontmatter.mjs so hook tests can
// exercise the real implementation instead of a copy

function readPluginConfig() {
  try {
    return JSON.parse(readFileSync(PLUGIN_CONFIG, 'utf-8'));
  } catch { return {}; }
}

function readJsonFile(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

function readTextFile(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return ''; }
}

function writePluginConfig(config) {
  writeFileSync(PLUGIN_CONFIG, JSON.stringify(config, null, 2) + '\n');
}

function isPortOpen(port) {
  return new Promise(resolve => {
    const socket = createConnection({ port, host: '127.0.0.1' }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function getRepoDir() {
  const scriptRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const runtime = readJsonFile(join(CLAUDE_DIR, 'vibecosystem-runtime.json'), {});
  for (const candidate of [scriptRepo, runtime.repoDir, join(homedir(), '.vibecosystem')]) {
    if (candidate && existsSync(join(candidate, 'install.sh')) && existsSync(join(candidate, 'profiles', 'runtime-manifest.json')) && existsSync(join(candidate, 'skills', 'build', 'SKILL.md'))) return candidate;
  }
  return null;
}

// ─── Commands ───

function help() {
  console.log(`
${c.bold}${c.cyan} vibecosystem${c.reset} ${dim(`v${VERSION}`)}
${dim('Your AI software team. Built on Claude Code.')}

${bold('USAGE')}
  ${cyan('vibeco')} ${dim('<command>')} ${dim('[options]')}

${bold('COMMANDS')}
  ${green('help')}                          Show this help
  ${green('version')}                       Show version
  ${green('stats')}                         Ecosystem statistics
  ${green('effective-config')}              Show model, profile, hooks and budgets
  ${green('list')} ${dim('<agents|skills|hooks|rules>')}  Browse components
    ${dim('--search <term>')}              Filter by name/description
  ${green('dashboard')}                     Start monitoring dashboard
  ${green('doctor')}                        Health check
    ${dim('--runtime')}                   Show hook runtime stats (24h)
  ${green('audit')} ${dim('[path]')}                  Security + quality scan
    ${dim('--report')}                   Save findings to .vibeco-audit.json
    ${dim('--json')}                     Output as JSON
  ${green('secrets')} ${dim('[path]')}                Scan for API keys & credentials
  ${green('profile')} ${dim('<name>')}                Install or switch runtime profile
    ${dim('core | quality | context | memory | orchestration | full')}
  ${green('search')} ${dim('<term> [term2 ...]')}          Search agents and skills by keyword
  ${green('update')}                        Pull latest & reinstall

${bold('EXAMPLES')}
  ${dim('$')} vibeco stats
  ${dim('$')} vibeco search database
  ${dim('$')} vibeco list agents --search security
  ${dim('$')} vibeco profile frontend
  ${dim('$')} vibeco doctor

${dim(`github.com/vibeeval/vibecosystem`)}
`);
}

function version() {
  console.log(`vibecosystem v${VERSION}`);
}

function stats() {
  const agents = countFiles(join(CLAUDE_DIR, 'agents'), '.md');
  const skills = countFiles(join(CLAUDE_DIR, 'skills'), 'dir');
  const hooks = countFiles(join(CLAUDE_DIR, 'hooks', 'dist'), '.mjs');
  const rules = countFiles(join(CLAUDE_DIR, 'rules'), '.md');

  // Error count
  let errors = 0;
  const ledger = join(CLAUDE_DIR, 'canavar', 'error-ledger.jsonl');
  try {
    const content = readFileSync(ledger, 'utf-8');
    errors = content.split('\n').filter(l => l.trim()).length;
  } catch {}

  // Instinct count
  let instincts = 0;
  const instinctsFile = join(CLAUDE_DIR, 'instincts.jsonl');
  try {
    const content = readFileSync(instinctsFile, 'utf-8');
    instincts = content.split('\n').filter(l => l.trim()).length;
  } catch {}

  // Active profile
  const config = readPluginConfig();
  const runtime = readJsonFile(join(CLAUDE_DIR, 'vibecosystem-runtime.json'), {});
  const profile = runtime.activeProfile || config.activeProfile || 'core';

  console.log(`
${bold('vibecosystem stats')}
${dim('─'.repeat(40))}

  ${cyan('Agents')}     ${bold(String(agents))}
  ${cyan('Skills')}     ${bold(String(skills))}
  ${cyan('Hooks')}      ${bold(String(hooks))}
  ${cyan('Rules')}      ${bold(String(rules))}

  ${cyan('Profile')}    ${bold(profile)}
  ${cyan('Errors')}     ${errors > 0 ? yellow(String(errors)) : green('0')}
  ${cyan('Instincts')}  ${bold(String(instincts))}

${dim('─'.repeat(40))}
  ${dim(`v${VERSION} | github.com/vibeeval/vibecosystem`)}
`);
}

function list() {
  const type = process.argv[3];
  if (!type || !['agents', 'skills', 'hooks', 'rules'].includes(type)) {
    console.log(`${red('Usage:')} vibeco list <agents|skills|hooks|rules> [--search <term>]`);
    return;
  }

  const searchIdx = process.argv.indexOf('--search');
  const search = searchIdx > -1 ? (process.argv[searchIdx + 1] || '').toLowerCase() : null;

  const items = [];

  if (type === 'agents') {
    const dir = join(CLAUDE_DIR, 'agents');
    try {
      for (const file of readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
        const name = basename(file, '.md');
        const content = readFileSync(join(dir, file), 'utf-8');
        const fm = parseFrontmatter(content);
        const desc = fm.description || '';
        const shortDesc = desc.length > 70 ? desc.slice(0, 67) + '...' : desc;
        items.push({ name, desc: shortDesc });
      }
    } catch {}
  } else if (type === 'skills') {
    const dir = join(CLAUDE_DIR, 'skills');
    try {
      for (const entry of readdirSync(dir).sort()) {
        const skillDir = join(dir, entry);
        if (!statSync(skillDir).isDirectory()) continue;
        const skillFile = existsSync(join(skillDir, 'SKILL.md')) ? 'SKILL.md' : 'prompt.md';
        const filePath = join(skillDir, skillFile);
        let desc = '';
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          const fm = parseFrontmatter(content);
          desc = fm.description || '';
        }
        const shortDesc = desc.length > 70 ? desc.slice(0, 67) + '...' : desc;
        items.push({ name: entry, desc: shortDesc });
      }
    } catch {}
  } else if (type === 'hooks') {
    const dir = join(CLAUDE_DIR, 'hooks', 'dist');
    try {
      for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
        const name = basename(file, '.mjs');
        items.push({ name, desc: '' });
      }
    } catch {}
  } else if (type === 'rules') {
    const dir = join(CLAUDE_DIR, 'rules');
    try {
      for (const file of readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
        const name = basename(file, '.md');
        items.push({ name, desc: '' });
      }
    } catch {}
  }

  // Filter
  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search) || i.desc.toLowerCase().includes(search))
    : items;

  // Display
  console.log(`\n${bold(`${type}`)} ${dim(`(${filtered.length}${search ? ` matching "${search}"` : ''})`)}\n`);

  const maxName = Math.min(Math.max(...filtered.map(i => i.name.length), 10), 35);
  for (const item of filtered) {
    const paddedName = item.name.padEnd(maxName);
    if (item.desc) {
      console.log(`  ${cyan(paddedName)}  ${dim(item.desc)}`);
    } else {
      console.log(`  ${cyan(paddedName)}`);
    }
  }
  console.log();
}

async function dashboard() {
  const running = await isPortOpen(DASHBOARD_PORT);
  if (running) {
    console.log(`${green('[OK]')} Dashboard already running at ${cyan(`http://127.0.0.1:${DASHBOARD_PORT}`)}`);
    return;
  }

  if (!existsSync(DASHBOARD_SCRIPT)) {
    console.log(`${red('[ERROR]')} Dashboard not found at ${DASHBOARD_SCRIPT}`);
    console.log(`${dim('Run install.sh to install the dashboard')}`);
    return;
  }

  try {
    createRequire(DASHBOARD_SCRIPT).resolve('ws');
  } catch {
    console.log(`${red('[ERROR]')} Dashboard dependency missing. Install the optional dashboard dependencies first:`);
    console.log(`  npm ci --ignore-scripts --prefix ${JSON.stringify(dirname(DASHBOARD_SCRIPT))}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Starting dashboard...`);
  const child = spawn('node', [DASHBOARD_SCRIPT], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Wait a moment for startup
  await new Promise(r => setTimeout(r, 1500));

  const ok = await isPortOpen(DASHBOARD_PORT);
  if (ok) {
    console.log(`${green('[OK]')} Dashboard running at ${cyan(`http://127.0.0.1:${DASHBOARD_PORT}`)}`);
  } else {
    console.log(`${yellow('[WARN]')} Dashboard may still be starting. Check ${cyan(`http://127.0.0.1:${DASHBOARD_PORT}`)}`);
  }
}

function profile() {
  const name = process.argv[3];
  const validProfiles = ['core', 'quality', 'context', 'memory', 'orchestration', 'dashboard', 'full', 'minimal', 'frontend', 'backend', 'fullstack', 'devops', 'all', 'smart'];

  if (!name || !validProfiles.includes(name)) {
    if (name) {
      console.error(`${red('[ERROR]')} Unknown profile: ${name}`);
      process.exitCode = 1;
    }
    const config = readPluginConfig();
    const runtime = readJsonFile(join(CLAUDE_DIR, 'vibecosystem-runtime.json'), {});
    const current = runtime.activeProfile || config.activeProfile || 'core';
    console.log(`\n${bold('Profiles')}\n`);
    for (const p of validProfiles) {
      const marker = p === current ? green(' (active)') : '';
      console.log(`  ${p === current ? bold(cyan(p)) : dim(p)}${marker}`);
    }
    console.log(`\n${dim('Usage:')} vibeco profile <name>\n`);
    return;
  }

  const repoDir = getRepoDir();
  if (repoDir) {
    try {
      installClaude({
        repoDir,
        profile: name,
        prune: true,
        nonInteractive: true,
      });
      return;
    } catch (error) {
      console.log(`${red('[ERROR]')} Profile install failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`${red('[ERROR]')} Runtime source not found. Re-run install.sh from a checkout or npx vibecosystem init.`);
  process.exitCode = 1;
}

function effectiveConfig() {
  const runtimePath = join(CLAUDE_DIR, 'vibecosystem-runtime.json');
  const runtime = readJsonFile(runtimePath, {});
  const globalWorkerPath = join(homedir(), '.codex', 'agents', 'luna-worker.toml');
  const repoDir = getRepoDir();
  const canonicalWorkerPath = join(repoDir || process.cwd(), '.codex', 'agents', 'luna-worker.toml');
  const workerPath = existsSync(globalWorkerPath) ? globalWorkerPath : canonicalWorkerPath;
  const workerSource = existsSync(globalWorkerPath)
    ? 'global ~/.codex/agents'
    : existsSync(canonicalWorkerPath) ? 'project .codex/agents' : 'missing';
  const workerToml = readTextFile(workerPath);
  const projectConfigPath = join(process.cwd(), '.codex', 'config.toml');
  const projectToml = readTextFile(projectConfigPath);
  const workerModel = workerToml.match(/^model\s*=\s*"([^"]+)"/m)?.[1] || null;
  const workerReasoning = workerToml.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m)?.[1] || null;
  const projectModel = projectToml.match(/^model\s*=\s*"([^"]+)"/m)?.[1] || null;
  const result = {
    modelAuthority: 'luna_worker',
    worker: {
      path: workerPath,
      source: workerSource,
      canonicalPath: canonicalWorkerPath,
      globalPath: globalWorkerPath,
      exists: existsSync(workerPath),
      model: workerModel,
      reasoning: workerReasoning,
    },
    projectConfig: {
      path: projectConfigPath,
      exists: existsSync(projectConfigPath),
      model: projectModel,
      modelNeutral: projectModel === null,
    },
    claudeRuntime: {
      profile: runtime.activeProfile || 'unknown',
      contextBudget: runtime.contextBudget || null,
      compiledHookFiles: countFiles(join(CLAUDE_DIR, 'hooks', 'dist'), '.mjs'),
      registeredHookCommands: runtime.registeredHookCommands || 0,
      ownedFiles: Array.isArray(runtime.ownedFiles) ? runtime.ownedFiles.length : 0,
    },
    skillPaths: {
      codex: join(homedir(), '.agents', 'skills'),
      claude: join(CLAUDE_DIR, 'skills'),
    },
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`\n${bold('vibecosystem effective-config')}`);
    console.log(`  ${cyan('Model authority')}  ${result.modelAuthority}`);
    console.log(`  ${cyan('Worker model')}     ${workerModel || 'missing'}`);
    console.log(`  ${cyan('Reasoning')}        ${workerReasoning || 'missing'}`);
    console.log(`  ${cyan('Worker source')}    ${workerSource}`);
    console.log(`  ${cyan('Project model')}    ${projectModel || 'none (inherited)'}`);
    console.log(`  ${cyan('Claude profile')}   ${result.claudeRuntime.profile}`);
    console.log(`  ${cyan('Hooks')}            ${result.claudeRuntime.registeredHookCommands} registered / ${result.claudeRuntime.compiledHookFiles} compiled`);
    console.log(`  ${cyan('Codex skills')}     ${result.skillPaths.codex}`);
    console.log(`  ${cyan('Hook commands')}    ${result.claudeRuntime.registeredHookCommands}`);
    console.log(`  ${cyan('Owned files')}      ${result.claudeRuntime.ownedFiles}`);
    if (result.claudeRuntime.contextBudget) {
      console.log(`  ${cyan('Context budget')}   ${result.claudeRuntime.contextBudget.perEventChars}/event, ${result.claudeRuntime.contextBudget.sessionChars}/session chars`);
    }
    console.log('');
  }
}

async function doctor() {
  console.log(`\n${bold('vibeco doctor')}`);
  console.log(dim('='.repeat(40)));

  let pass = 0;
  let warn = 0;
  let fail = 0;

  function check(status, msg, hint) {
    if (status === 'pass') { pass++; console.log(`  ${green('[PASS]')} ${msg}`); }
    else if (status === 'warn') { warn++; console.log(`  ${yellow('[WARN]')} ${msg}${hint ? dim(` (${hint})`) : ''}`); }
    else { fail++; console.log(`  ${red('[FAIL]')} ${msg}${hint ? dim(` (${hint})`) : ''}`); }
  }

  // 1. ~/.claude/ exists
  check(existsSync(CLAUDE_DIR) ? 'pass' : 'fail', '~/.claude/ directory');

  // 2. Agent count
  const agents = countFiles(join(CLAUDE_DIR, 'agents'), '.md');
  const runtimeState = readJsonFile(join(CLAUDE_DIR, 'vibecosystem-runtime.json'), {});
  check(agents > 0 ? 'pass' : 'fail', `Agents: ${agents}`, agents === 0 ? 'run install with a profile' : '');

  // 3. Skill count
  const skills = countFiles(join(CLAUDE_DIR, 'skills'), 'dir');
  check(skills > 0 ? 'pass' : 'fail', `Skills: ${skills}`, skills === 0 ? 'run install with a profile' : '');

  const config = readPluginConfig();
  const activeProfile = runtimeState.activeProfile || config.activeProfile || 'unknown';

  // 4. Hook count
  const hooks = countFiles(join(CLAUDE_DIR, 'hooks', 'dist'), '.mjs');
  const registeredHookCommands = Number(runtimeState.registeredHookCommands || 0);
  check(registeredHookCommands > 0 ? 'pass' : 'warn', `Hooks: ${hooks} compiled, ${registeredHookCommands} registered`, registeredHookCommands === 0 ? 'run profile install' : '');

  // 5. Rule count
  const rules = countFiles(join(CLAUDE_DIR, 'rules'), '.md');
  const rulesOptional = activeProfile !== 'full' && activeProfile !== 'all';
  check(rules > 0 || rulesOptional ? 'pass' : 'warn', `Rules: ${rules}`, rules === 0 && !rulesOptional ? 'full profile rules are missing' : '');

  // 6. settings.json hooks
  try {
    const settings = JSON.parse(readFileSync(join(CLAUDE_DIR, 'settings.json'), 'utf-8'));
    const hasHooks = settings.hooks && Object.keys(settings.hooks).length > 0;
    check(hasHooks ? 'pass' : 'fail', 'Hook registrations in settings.json', hasHooks ? '' : 'no hooks registered');
  } catch {
    check('fail', 'settings.json', 'file not found or invalid');
  }

  // 7. Dashboard
  const dashRunning = await isPortOpen(DASHBOARD_PORT);
  check(dashRunning ? 'pass' : 'warn', `Dashboard${dashRunning ? ' running' : ' not running'}`, dashRunning ? '' : 'vibeco dashboard');

  // 8. Memory DB
  const canavarDir = join(CLAUDE_DIR, 'canavar');
  const hasCanavar = existsSync(canavarDir);
  if (hasCanavar) {
    const ledger = join(canavarDir, 'error-ledger.jsonl');
    const matrix = join(canavarDir, 'skill-matrix.json');
    const hasData = existsSync(ledger) || existsSync(matrix);
    check(hasData ? 'pass' : 'warn', 'Canavar data', hasData ? '' : 'no error ledger or skill matrix');
  } else {
    check('warn', 'Canavar directory', 'not found');
  }

  // 9. Active profile
  check(activeProfile !== 'unknown' ? 'pass' : 'warn', `Profile: ${activeProfile}`, activeProfile === 'unknown' ? 'run profile install' : '');

  // 10. PATH
  const pathIncludesLocal = (process.env.PATH || '').includes(join(homedir(), '.local', 'bin'));
  check(pathIncludesLocal ? 'pass' : 'warn', '~/.local/bin in PATH', pathIncludesLocal ? '' : 'add to PATH for vibeco command');

  // 11. Node.js version
  const nodeVer = parseInt(process.version.slice(1));
  check(nodeVer >= 18 ? 'pass' : nodeVer >= 16 ? 'warn' : 'fail', `Node.js ${process.version}`, nodeVer < 18 ? 'recommended >= 18' : '');

  // Summary
  const total = pass + warn + fail;
  const score = Math.round((pass / total) * 100);
  const status = fail > 0 ? red('UNHEALTHY') : warn > 0 ? yellow('MOSTLY HEALTHY') : green('HEALTHY');
  console.log(`\n${dim('─'.repeat(40))}`);
  console.log(`  Health: ${bold(`${pass}/${total}`)} (${score}%) ${status}\n`);

  // --runtime flag: hook health stats
  if (process.argv.includes('--runtime')) {
    await showRuntimeHealth();
  }
}

async function showRuntimeHealth() {
  const healthFile = join(CLAUDE_DIR, 'hook-health.jsonl');
  if (!existsSync(healthFile)) {
    console.log(`${dim('  No runtime health data yet (hook-health.jsonl)')}\n`);
    return;
  }

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);

  const lines = readFileSync(healthFile, 'utf-8').split('\n').filter(l => l.trim());
  const recent = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (new Date(entry.ts) >= cutoff) recent.push(entry);
    } catch {}
  }

  if (recent.length === 0) {
    console.log(`${dim('  No hook activity in last 24h')}\n`);
    return;
  }

  // Group by hook name
  const grouped = new Map();
  for (const entry of recent) {
    const name = entry.hook || 'unknown';
    if (!grouped.has(name)) grouped.set(name, { runs: 0, success: 0, totalMs: 0, errors: [] });
    const g = grouped.get(name);
    g.runs++;
    if (entry.success) g.success++;
    g.totalMs += entry.duration_ms || 0;
    if (entry.error) g.errors.push(entry.error);
  }

  console.log(`${bold('Hook Health')} ${dim('(last 24h)')}`);
  console.log(dim('─'.repeat(40)));

  const sorted = [...grouped.entries()].sort((a, b) => b[1].runs - a[1].runs);
  for (const [name, data] of sorted) {
    const pct = Math.round((data.success / data.runs) * 100);
    const avg = Math.round(data.totalMs / data.runs);
    const indicator = pct === 100 ? green(`${pct}%`) : pct >= 80 ? yellow(`${pct}%`) : red(`${pct}%`);
    const broken = pct < 80 ? red(' <- BROKEN') : '';
    console.log(`  ${name.padEnd(24)} ${String(data.runs).padStart(4)} runs, ${indicator} success, avg ${avg}ms${broken}`);
  }
  console.log('');
}

function search() {
  const terms = process.argv.slice(3);
  if (terms.length === 0) {
    console.log(`${red('Usage:')} vibeco search <term> [term2 ...]`);
    return;
  }

  const lowerTerms = terms.map(t => t.toLowerCase());
  const exactPhrase = lowerTerms.join(' ');

  function score(name, desc) {
    const lName = name.toLowerCase();
    const lDesc = desc.toLowerCase();
    let s = 0;
    if (lName.includes(exactPhrase)) s += 10;
    for (const word of lowerTerms) {
      if (lName.includes(word)) s += 5;
      if (lDesc.includes(word)) s += 3;
    }
    return s;
  }

  // Load agents
  const agents = [];
  const agentsDir = join(CLAUDE_DIR, 'agents');
  try {
    for (const file of readdirSync(agentsDir).filter(f => f.endsWith('.md')).sort()) {
      const name = basename(file, '.md');
      const content = readFileSync(join(agentsDir, file), 'utf-8');
      const fm = parseFrontmatter(content);
      const desc = fm.description || '';
      const s = score(name, desc);
      if (s > 0) agents.push({ name, desc, score: s });
    }
  } catch {}
  agents.sort((a, b) => b.score - a.score);
  const topAgents = agents.slice(0, 10);

  // Load skills
  const skills = [];
  const skillsDir = join(CLAUDE_DIR, 'skills');
  try {
    for (const entry of readdirSync(skillsDir).sort()) {
      const skillDir = join(skillsDir, entry);
      if (!statSync(skillDir).isDirectory()) continue;
      const skillFile = existsSync(join(skillDir, 'SKILL.md')) ? 'SKILL.md' : 'prompt.md';
      const filePath = join(skillDir, skillFile);
      let desc = '';
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        const fm = parseFrontmatter(content);
        desc = fm.description || '';
      }
      const s = score(entry, desc);
      if (s > 0) skills.push({ name: entry, desc, score: s });
    }
  } catch {}
  skills.sort((a, b) => b.score - a.score);
  const topSkills = skills.slice(0, 10);

  const totalMatches = agents.length + skills.length;
  if (totalMatches === 0) {
    console.log(`\n${dim(`No results for "${terms.join(' ')}"`)}\n`);
    return;
  }

  function printSection(title, items) {
    if (items.length === 0) return;
    const shown = items.length;
    const total = title === 'Agents' ? agents.length : skills.length;
    const label = shown < total ? `${shown} of ${total} matches` : `${shown} match${shown !== 1 ? 'es' : ''}`;
    console.log(`  ${bold(title)} ${dim(`(${label})`)}`);
    const maxName = Math.min(Math.max(...items.map(i => i.name.length), 10), 35);
    for (const item of items) {
      const paddedName = item.name.padEnd(maxName);
      const shortDesc = item.desc.length > 60 ? item.desc.slice(0, 57) + '...' : item.desc;
      if (shortDesc) {
        console.log(`    ${cyan(paddedName)}  ${dim(shortDesc)}`);
      } else {
        console.log(`    ${cyan(paddedName)}`);
      }
    }
    console.log();
  }

  console.log();
  printSection('Agents', topAgents);
  printSection('Skills', topSkills);
}

async function update() {
  const repoDir = getRepoDir();
  if (!repoDir) {
    console.log(`${red('[ERROR]')} Cannot find vibecosystem repo`);
    console.log(`${dim('Expected at ~/.vibecosystem/ or linked from this script')}`);
    return;
  }

  console.log(`Updating from ${dim(repoDir)}...`);

  try {
    execSync('git pull --ff-only', { cwd: repoDir, stdio: 'inherit' });
  } catch {
    console.log(`${red('[ERROR]')} git pull failed`);
    return;
  }

  console.log(`\nReinstalling...`);
  try {
    const runtime = readJsonFile(join(CLAUDE_DIR, 'vibecosystem-runtime.json'), {});
    const allowedProfiles = new Set(['core', 'quality', 'context', 'memory', 'orchestration', 'dashboard', 'full']);
    const activeProfile = allowedProfiles.has(runtime.activeProfile) ? runtime.activeProfile : 'core';
    execFileSync('bash', ['install.sh', '--profile', activeProfile, '--non-interactive'], { cwd: repoDir, stdio: 'inherit' });
  } catch {
    console.log(`${red('[ERROR]')} install.sh failed`);
    return;
  }

  console.log(`\n${green('[OK]')} vibecosystem updated`);
}

// ─── Audit ───

const AUDIT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rb', '.php', '.mjs', '.cjs'];

const SAST_PATTERNS = [
  { pattern: /\beval\s*\(/, severity: 'CRITICAL', category: 'Code Injection', message: 'eval() usage detected' },
  { pattern: /\bnew\s+Function\s*\(/, severity: 'CRITICAL', category: 'Code Injection', message: 'new Function() detected' },
  { pattern: /(?<!\w\.)exec\s*\(/, severity: 'CRITICAL', category: 'Command Injection', message: 'exec() usage detected' },
  { pattern: /\bexecSync\s*\(/, severity: 'CRITICAL', category: 'Command Injection', message: 'execSync() usage detected' },
  { pattern: /\bos\.system\s*\(/, severity: 'CRITICAL', category: 'Command Injection', message: 'os.system() detected' },
  { pattern: /\bsubprocess\.\w+\s*\(/, severity: 'CRITICAL', category: 'Command Injection', message: 'subprocess usage detected' },
  { pattern: /["'`]\s*\+\s*\w+.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)\b/i, severity: 'CRITICAL', category: 'SQL Injection', message: 'String concat in SQL query' },
  { pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\b.*\$\{/i, severity: 'CRITICAL', category: 'SQL Injection', message: 'Template literal in SQL query' },
  { pattern: /\.innerHTML\s*=/, severity: 'HIGH', category: 'XSS', message: 'innerHTML assignment' },
  { pattern: /dangerouslySetInnerHTML/, severity: 'HIGH', category: 'XSS', message: 'dangerouslySetInnerHTML usage' },
  { pattern: /document\.write\s*\(/, severity: 'HIGH', category: 'XSS', message: 'document.write() usage' },
  { pattern: /pickle\.loads?\s*\(/, severity: 'HIGH', category: 'Insecure Deserialization', message: 'pickle.load(s) usage' },
  { pattern: /yaml\.load\s*\([^)]*\)\s*(?!.*Loader)/, severity: 'HIGH', category: 'Insecure Deserialization', message: 'yaml.load() without Loader' },
  { pattern: /console\.log\s*\(.*(?:password|secret|token|key|credential|auth)/i, severity: 'MEDIUM', category: 'Data Exposure', message: 'Sensitive data in console.log' },
  { pattern: /\bMD5\s*\(|\.md5\s*\(/i, severity: 'MEDIUM', category: 'Weak Crypto', message: 'MD5 usage detected' },
  { pattern: /\bSHA1\s*\(|\.sha1\s*\(/i, severity: 'MEDIUM', category: 'Weak Crypto', message: 'SHA1 usage detected' },
  { pattern: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i, severity: 'HIGH', category: 'Hardcoded Secret', message: 'Possible hardcoded secret' },
];

function walkDir(dir, extensions, ignore = []) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.') || ignore.includes(entry)) continue;
      const full = join(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          results.push(...walkDir(full, extensions, ignore));
        } else if (extensions.some(ext => entry.endsWith(ext))) {
          results.push(full);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return results;
}

async function audit() {
  const targetDir = process.argv[3] || process.cwd();
  const doFix = process.argv.includes('--fix');
  const jsonOut = process.argv.includes('--json');

  if (!existsSync(targetDir)) {
    console.log(`${red('[ERROR]')} Directory not found: ${targetDir}`);
    return;
  }

  console.log(`\n${bold('vibeco audit')} ${dim(targetDir)}`);
  console.log(dim('='.repeat(50)));

  const ignore = ['node_modules', 'dist', '.git', 'vendor', '__pycache__', '.next', 'build', 'coverage'];
  const files = walkDir(targetDir, AUDIT_EXTENSIONS, ignore);

  if (files.length === 0) {
    console.log(`\n${yellow('[WARN]')} No source files found to audit`);
    return;
  }

  console.log(`\n  Scanning ${cyan(String(files.length))} files...\n`);

  const report = {
    timestamp: new Date().toISOString(),
    directory: targetDir,
    files_scanned: files.length,
    security: [],
    quality: { large_files: [], todo_fixme: [], console_logs: [] },
    dead_code: { unused_imports_hint: [] },
    summary: { critical: 0, high: 0, medium: 0, low: 0, total_issues: 0 },
  };

  // ─── Security Scan ───
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf-8'); } catch { continue; }
    const lines = content.split('\n');
    const rel = file.replace(targetDir + '/', '');
    const isTest = /\.(test|spec)\.[jt]sx?$/.test(file) || file.includes('__tests__') || file.includes('__mocks__');

    if (!isTest) for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

      for (const pat of SAST_PATTERNS) {
        if (pat.pattern.test(line)) {
          const existing = report.security.find(s => s.file === rel && s.category === pat.category);
          if (!existing) {
            report.security.push({
              file: rel, line: i + 1, severity: pat.severity,
              category: pat.category, message: pat.message,
              code: trimmed.slice(0, 100),
            });
          }
        }
      }
    }

    // ─── Quality: Large files ───
    if (lines.length > 500) {
      report.quality.large_files.push({ file: rel, lines: lines.length });
    }

    // ─── Quality: TODO/FIXME ───
    let todoCount = 0;
    for (const line of lines) {
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) todoCount++;
    }
    if (todoCount > 0) {
      report.quality.todo_fixme.push({ file: rel, count: todoCount });
    }

    // ─── Quality: console.log ───
    let logCount = 0;
    for (const line of lines) {
      if (/\bconsole\.log\s*\(/.test(line) && !line.trim().startsWith('//')) logCount++;
    }
    if (logCount > 3) {
      report.quality.console_logs.push({ file: rel, count: logCount });
    }
  }

  // ─── Dead code hints: check test file ratio ───
  const testFiles = files.filter(f => /\.(test|spec)\.[jt]sx?$/.test(f));
  const srcFiles = files.filter(f => !/\.(test|spec)\.[jt]sx?$/.test(f));
  const testRatio = srcFiles.length > 0 ? (testFiles.length / srcFiles.length * 100).toFixed(1) : '0';

  // ─── Dependency check ───
  let depIssues = [];
  const pkgPath = join(targetDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const lockPath = join(targetDir, 'package-lock.json');
      if (!existsSync(lockPath) && !existsSync(join(targetDir, 'yarn.lock')) && !existsSync(join(targetDir, 'pnpm-lock.yaml'))) {
        depIssues.push({ severity: 'MEDIUM', message: 'No lock file found (package-lock.json, yarn.lock, or pnpm-lock.yaml)' });
      }
      // Check for very old node engine
      if (pkg.engines?.node && /[<]16|[<]=?14|[<]=?12/.test(pkg.engines.node)) {
        depIssues.push({ severity: 'MEDIUM', message: `Outdated node engine requirement: ${pkg.engines.node}` });
      }
    } catch { /* skip */ }
  }

  // ─── Summary ───
  for (const s of report.security) {
    if (s.severity === 'CRITICAL') report.summary.critical++;
    else if (s.severity === 'HIGH') report.summary.high++;
    else if (s.severity === 'MEDIUM') report.summary.medium++;
    else report.summary.low++;
  }
  report.summary.total_issues = report.security.length + report.quality.large_files.length +
    report.quality.todo_fixme.length + report.quality.console_logs.length + depIssues.length;

  // ─── Print Report ───
  // Security
  if (report.security.length > 0) {
    console.log(`${bold('Security Issues')} ${dim(`(${report.security.length})`)}`);
    console.log(dim('-'.repeat(50)));
    for (const s of report.security) {
      const sev = s.severity === 'CRITICAL' ? red(s.severity) : s.severity === 'HIGH' ? yellow(s.severity) : dim(s.severity);
      console.log(`  ${sev.padEnd(20)} ${s.file}:${s.line}`);
      console.log(`  ${dim(s.message)}`);
      console.log(`  ${dim(s.code)}`);
      console.log();
    }
  } else {
    console.log(`${green('[CLEAN]')} No security issues found\n`);
  }

  // Quality
  if (report.quality.large_files.length > 0) {
    console.log(`${bold('Large Files')} ${dim(`(>500 lines)`)}`);
    console.log(dim('-'.repeat(50)));
    for (const f of report.quality.large_files.sort((a, b) => b.lines - a.lines)) {
      console.log(`  ${yellow(String(f.lines).padStart(5))} lines  ${f.file}`);
    }
    console.log();
  }

  if (report.quality.todo_fixme.length > 0) {
    console.log(`${bold('TODO/FIXME')} ${dim(`(${report.quality.todo_fixme.reduce((s, t) => s + t.count, 0)} total)`)}`);
    console.log(dim('-'.repeat(50)));
    for (const t of report.quality.todo_fixme.sort((a, b) => b.count - a.count).slice(0, 10)) {
      console.log(`  ${yellow(String(t.count).padStart(3))}x  ${t.file}`);
    }
    console.log();
  }

  if (report.quality.console_logs.length > 0) {
    console.log(`${bold('Excessive console.log')} ${dim(`(>3 per file)`)}`);
    console.log(dim('-'.repeat(50)));
    for (const l of report.quality.console_logs.sort((a, b) => b.count - a.count)) {
      console.log(`  ${yellow(String(l.count).padStart(3))}x  ${l.file}`);
    }
    console.log();
  }

  if (depIssues.length > 0) {
    console.log(`${bold('Dependency Issues')}`);
    console.log(dim('-'.repeat(50)));
    for (const d of depIssues) {
      console.log(`  ${yellow(d.severity)}  ${d.message}`);
    }
    console.log();
  }

  // Test coverage
  console.log(`${bold('Test Coverage')}`);
  console.log(dim('-'.repeat(50)));
  const ratioNum = parseFloat(testRatio);
  const ratioColor = ratioNum >= 30 ? green : ratioNum >= 10 ? yellow : red;
  console.log(`  Source files:  ${srcFiles.length}`);
  console.log(`  Test files:    ${testFiles.length}`);
  console.log(`  Test ratio:    ${ratioColor(testRatio + '%')}`);
  console.log();

  // Summary
  const totalIssues = report.summary.total_issues;
  const grade = report.summary.critical > 0 ? red('F') :
    report.summary.high > 3 ? red('D') :
    report.summary.high > 0 ? yellow('C') :
    report.summary.medium > 5 ? yellow('B') :
    totalIssues > 0 ? green('A-') : green('A+');

  console.log(dim('='.repeat(50)));
  console.log(`${bold('Audit Grade:')} ${bold(grade)}`);
  console.log(`  ${red('CRITICAL')}: ${report.summary.critical}  ${yellow('HIGH')}: ${report.summary.high}  ${dim('MEDIUM')}: ${report.summary.medium}`);
  console.log(`  Total issues: ${totalIssues}  |  Files: ${files.length}  |  Test ratio: ${testRatio}%`);

  // Save JSON report only when explicitly requested
  if (process.argv.includes('--report') || jsonOut) {
    const reportPath = join(targetDir, '.vibeco-audit.json');
    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n  Report saved: ${dim(reportPath)}`);
    } catch { /* skip */ }
  }

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  }

  if (totalIssues > 0) {
    console.log(`\n  ${cyan('Tip:')} Run ${bold('vibeco audit --report')} to save findings as JSON.`);
  }

  // ─── Auto-fix mode ───
  if (doFix) {
    console.log(`\n${bold('Auto-fix is not available yet.')}`);
    console.log(`  Security issues require manual review.`);
    console.log(`  Use ${cyan('vibeco audit --report')} to save findings as JSON.\n`);
  }

  console.log();
}

// ─── Secrets Scanner ───

const SECRET_PATTERNS = [
  { pattern: /sk-proj-[A-Za-z0-9_-]{20,}/, name: 'OpenAI API Key (project)' },
  { pattern: /sk-[A-Za-z0-9]{20,}/, name: 'OpenAI API Key' },
  { pattern: /sk-ant-[A-Za-z0-9_-]{20,}/, name: 'Anthropic API Key' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key ID' },
  { pattern: /ghp_[A-Za-z0-9]{36,}/, name: 'GitHub Personal Access Token' },
  { pattern: /gho_[A-Za-z0-9]{36,}/, name: 'GitHub OAuth Token' },
  { pattern: /github_pat_[A-Za-z0-9_]{22,}/, name: 'GitHub Fine-grained PAT' },
  { pattern: /sk_live_[A-Za-z0-9]{20,}/, name: 'Stripe Secret Key (Live)' },
  { pattern: /pk_live_[A-Za-z0-9]{20,}/, name: 'Stripe Publishable Key (Live)' },
  { pattern: /sq0csp-[A-Za-z0-9_-]{20,}/, name: 'Square Access Token' },
  { pattern: /AIza[A-Za-z0-9_-]{35}/, name: 'Google API Key' },
  { pattern: /ya29\.[A-Za-z0-9_-]{50,}/, name: 'Google OAuth Token' },
  { pattern: /xoxb-[0-9]+-[A-Za-z0-9]+/, name: 'Slack Bot Token' },
  { pattern: /xoxp-[0-9]+-[A-Za-z0-9]+/, name: 'Slack User Token' },
  { pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/, name: 'SendGrid API Key' },
  { pattern: /npm_[A-Za-z0-9]{36,}/, name: 'npm Access Token' },
  { pattern: /pypi-[A-Za-z0-9_-]{50,}/, name: 'PyPI API Token' },
  { pattern: /PRIVATE KEY-----/, name: 'Private Key (PEM)' },
  { pattern: /(?:mongodb(?:\+srv)?:\/\/)(?:[^:]+):([^@]{8,})@/, name: 'MongoDB Connection String with Password' },
  { pattern: /(?:postgres(?:ql)?:\/\/)(?:[^:]+):([^@]{8,})@/, name: 'PostgreSQL Connection String with Password' },
  { pattern: /(?:mysql:\/\/)(?:[^:]+):([^@]{8,})@/, name: 'MySQL Connection String with Password' },
  { pattern: /(?:redis:\/\/)(?::)?([^@]{8,})@/, name: 'Redis Connection String with Password' },
];

const SECRETS_SCAN_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.rb', '.php', '.rs', '.swift', '.kt',
  '.json', '.yml', '.yaml', '.toml', '.env', '.cfg', '.conf', '.ini',
  '.sh', '.bash', '.zsh', '.fish',
  '.xml', '.properties', '.gradle',
];

const SECRETS_IGNORE = ['node_modules', 'dist', '.git', 'vendor', '__pycache__', '.next', 'build', 'coverage', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

function secrets() {
  const targetDir = process.argv[3] || process.cwd();

  if (!existsSync(targetDir)) {
    console.log(`${red('[ERROR]')} Directory not found: ${targetDir}`);
    process.exit(1);
  }

  console.log(`\n${bold('vibeco secrets')} ${dim(targetDir)}`);
  console.log(dim('='.repeat(50)));

  const files = walkDir(targetDir, SECRETS_SCAN_EXTENSIONS, SECRETS_IGNORE);
  console.log(`\n  Scanning ${cyan(String(files.length))} files for secrets...\n`);

  const findings = [];

  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf-8'); } catch { continue; }

    // Skip binary-looking files
    if (content.includes('\0')) continue;

    const lines = content.split('\n');
    const rel = file.replace(targetDir + '/', '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

      // Skip lines that look like pattern definitions (regex literals, test assertions)
      if (/\/(\\\/|[^/])+\/[gimsuy]*/.test(trimmed) && (trimmed.includes('pattern') || trimmed.includes('regex') || trimmed.includes('RegExp'))) continue;

      for (const secret of SECRET_PATTERNS) {
        const match = secret.pattern.exec(line);
        if (match) {
          // Localhost dev varsayilanlari secret degildir (or. Docker compose
          // fallback'leri) - connection-string pattern'lerinde host'u kontrol et
          if (secret.name.includes('Connection String') && /@(localhost|127\.0\.0\.1|\[?::1)/.test(line)) {
            continue;
          }
          // Mask the secret value
          const value = match[0];
          const masked = value.slice(0, 8) + '***' + value.slice(-4);
          findings.push({
            file: rel,
            line: i + 1,
            type: secret.name,
            masked,
          });
          break; // One finding per line is enough
        }
      }
    }
  }

  if (findings.length === 0) {
    console.log(`${green('[CLEAN]')} No secrets found!\n`);
    console.log(`  ${dim('Scanned')} ${files.length} ${dim('files, zero API keys or credentials detected.')}\n`);
    return;
  }

  // Print findings
  console.log(`${red('[ALERT]')} Found ${bold(String(findings.length))} potential secret(s)!\n`);

  for (const f of findings) {
    console.log(`  ${red('SECRET')}  ${f.file}:${f.line}`);
    console.log(`  ${dim('Type:')}   ${f.type}`);
    console.log(`  ${dim('Value:')}  ${yellow(f.masked)}`);
    console.log();
  }

  console.log(dim('='.repeat(50)));
  console.log(`  ${red(String(findings.length))} secret(s) found in ${files.length} files`);
  console.log(`\n  ${bold('DO NOT push these files to GitHub!')}`);
  console.log(`  ${dim('1. Remove or move secrets to .env files')}`);
  console.log(`  ${dim('2. Add .env to .gitignore')}`);
  console.log(`  ${dim('3. Use environment variables instead')}`);
  console.log(`  ${dim('4. If already pushed, rotate the credentials immediately')}\n`);

  process.exit(1); // Exit with error so pre-push hook blocks
}

// ─── Router ───
const COMMANDS = {
  help,
  version,
  stats,
  'effective-config': effectiveConfig,
  list,
  search,
  dashboard,
  profile,
  doctor,
  audit,
  secrets,
  update,
  '-h': help,
  '--help': help,
  '-v': version,
  '--version': version,
};

const cmd = process.argv[2] || 'help';
const handler = COMMANDS[cmd];

if (!handler) {
  console.log(`${red('Unknown command:')} ${cmd}`);
  console.log(`${dim('Run')} vibeco help ${dim('for available commands')}`);
  process.exit(1);
}

const result = handler();
if (result instanceof Promise) result.catch(err => { console.error(red(err.message)); process.exit(1); });
