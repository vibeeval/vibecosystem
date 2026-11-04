#!/usr/bin/env node
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { filterHookManifest, resolveProfile } from './profile-runtime.mjs';
import { mergeOwnedHooks } from './register-hooks.mjs';

const DEFAULT_REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (content) => createHash('sha256').update(content).digest('hex');
const hashFile = (path) => hash(readFileSync(path));
const fileMode = (path) => lstatSync(path).mode & 0o777;
const knownFileMode = (modes, label) => Number.isInteger(modes[label]) && modes[label] >= 0 && modes[label] <= 0o777 ? modes[label] : null;
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
function readJson(path, fallback = {}) {
  if (!existsSync(path)) return fallback;
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must contain a JSON object`);
  return value;
}
function assertSafePath(path, boundary = dirname(path)) {
  let current = resolve(path);
  while (current !== resolve(boundary)) {
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`Refusing installer path through symlink: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
function ownedPath(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error('Invalid path in ownership manifest');
  const full = resolve(root, path);
  if (!full.startsWith(`${resolve(root)}${sep}`)) throw new Error('Ownership path escapes runtime directory');
  assertSafePath(full, dirname(root));
  return full;
}
function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing source symlink: ${path}`);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
const listFiles = (dir, suffix) => readdirSync(dir, { withFileTypes: true }).filter((x) => x.isFile() && x.name.endsWith(suffix)).map((x) => x.name);
const listDirs = (dir) => readdirSync(dir, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);
function backupFile(source, backupRoot, label) {
  const target = join(backupRoot, label);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  chmodSync(target, fileMode(source));
}

export function installClaude({ repoDir = DEFAULT_REPO_DIR, profile = 'core', force = false, prune = true, dryRun = false, claudeDir = join(homedir(), '.claude'), nonInteractive = false, binDir = join(homedir(), '.local', 'bin') } = {}) {
  repoDir = resolve(repoDir);
  claudeDir = resolve(claudeDir);
  if (claudeDir === dirname(claudeDir) || claudeDir === resolve(homedir())) throw new Error('Refusing unsafe runtime directory');
  assertSafePath(claudeDir);
  assertSafePath(binDir, dirname(dirname(binDir)));
  const runtime = resolveProfile(repoDir, profile);
  const statePath = join(claudeDir, 'vibecosystem-runtime.json');
  const configPath = join(claudeDir, 'plugin-config.json');
  const settingsPath = join(claudeDir, 'settings.json');
  for (const path of [statePath, configPath, settingsPath]) assertSafePath(path);
  // Validate before writing anything: invalid user settings must never become a successful install.
  const previousState = readJson(statePath);
  const settings = readJson(settingsPath);
  const pluginConfig = readJson(configPath);
  const ownedBefore = new Set(previousState.ownedFiles || []);
  const oldHashes = previousState.ownedFileHashes || {};
  const oldModes = previousState.ownedFileModes || {};
  for (const path of ownedBefore) ownedPath(claudeDir, path);
  const desired = new Map();
  const stats = { added: 0, overwritten: 0, unchanged: 0, skipped: 0, conflicts: 0, pruned: 0, preserved: 0, modesUpdated: 0 };
  const backupRoot = join(claudeDir, 'backups', `vibecosystem-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  assertSafePath(backupRoot, dirname(claudeDir));
  const select = (kind, suffix = '') => runtime[kind] === 'all'
    ? (suffix ? listFiles(join(repoDir, kind === 'hooks' ? 'hooks/dist' : kind), suffix).map((x) => basename(x, suffix)) : listDirs(join(repoDir, kind)))
    : runtime[kind];
  const agentNames = select('agents', '.md');
  const skillNames = select('skills');
  const ruleNames = runtime.rules === 'all' ? listFiles(join(repoDir, 'rules'), '.md') : runtime.rules;
  const hookNames = select('hooks', '.mjs');
  const addSource = (source, label) => {
    if (!existsSync(source)) throw new Error(`Profile ${profile} references missing file: ${source}`);
    assertSafePath(source);
    desired.set(label, { content: readFileSync(source), mode: fileMode(source) });
  };
  for (const name of agentNames) addSource(join(repoDir, 'agents', `${name}.md`), join('agents', `${name}.md`));
  for (const name of skillNames) {
    const root = join(repoDir, 'skills', name);
    if (!existsSync(join(root, 'SKILL.md'))) throw new Error(`Profile ${profile} references missing skill: ${name}`);
    for (const file of walkFiles(root)) addSource(file, join('skills', name, relative(root, file)));
  }
  for (const name of ruleNames) addSource(join(repoDir, 'rules', name), join('rules', name));
  for (const name of hookNames) addSource(join(repoDir, 'hooks', 'dist', `${name}.mjs`), join('hooks', 'dist', `${name}.mjs`));
  const manifest = filterHookManifest(readJson(join(repoDir, 'hooks', 'hooks.json')), runtime.hooks);
  desired.set(join('hooks', 'hooks.json'), { content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), mode: 0o644 });
  for (const file of listFiles(join(repoDir, 'profiles'), '.json')) addSource(join(repoDir, 'profiles', file), join('profiles', file));
  // CLI imports its installer helpers; retain its source location to reconcile profiles later.
  for (const root of ['tools/vibeco', 'tools/dashboard']) {
    for (const file of walkFiles(join(repoDir, root))) {
      if (relative(join(repoDir, root), file).split(sep).includes('node_modules')) continue;
      addSource(file, relative(repoDir, file));
    }
  }
  for (const file of ['tools/install-runtime.mjs', 'tools/profile-runtime.mjs', 'tools/register-hooks.mjs']) addSource(join(repoDir, file), file);
  const merged = mergeOwnedHooks({ manifest, settings, claudeDir, ownedHookKeys: previousState.ownedHookKeys });
  const nextHashes = {};
  const nextModes = {};
  const retained = [];
  const operations = [];
  for (const [label, item] of desired) {
    const target = ownedPath(claudeDir, label);
    const nextHash = hash(item.content);
    const present = existsSync(target);
    if (present && !lstatSync(target).isFile()) throw new Error(`Expected a regular file: ${target}`);
    const currentHash = present ? hashFile(target) : null;
    const currentMode = present ? fileMode(target) : null;
    const hasBaseline = Object.hasOwn(oldHashes, label);
    const knownHash = typeof oldHashes[label] === 'string' ? oldHashes[label] : null;
    // Legacy ownership alone is not proof of unchanged content. An explicit
    // null records an unresolved conflict and must survive subsequent runs.
    const unchangedOwned = ownedBefore.has(label) && (knownHash ? knownHash === currentHash : !hasBaseline && currentHash === nextHash);
    if (present && !force && (!unchangedOwned || !ownedBefore.has(label))) {
      stats.skipped += 1;
      stats.conflicts += 1;
      if (ownedBefore.has(label)) { nextHashes[label] = knownHash; nextModes[label] = knownFileMode(oldModes, label); retained.push(label); }
      continue;
    }
    nextHashes[label] = nextHash;
    let targetMode = item.mode;
    const knownMode = knownFileMode(oldModes, label);
    const modeConflict = present && !force && (Object.hasOwn(oldModes, label)
      ? knownMode === null || currentMode !== knownMode
      : currentMode !== item.mode && currentMode !== 0o644);
    // The old byte-copy installer created 0644 files even for executable source.
    // Repair that legacy default only for unchanged owned content. Once modes
    // are tracked, preserve subsequent user changes instead of adopting them.
    if (modeConflict) {
      targetMode = currentMode;
      nextModes[label] = knownMode;
      retained.push(label);
      stats.conflicts += 1;
      stats.preserved += 1;
    } else nextModes[label] = item.mode;
    if (currentHash === nextHash) {
      if (currentMode === targetMode) stats.unchanged += 1;
      else {
        stats.modesUpdated += 1;
        operations.push(() => { backupFile(target, backupRoot, label); chmodSync(target, targetMode); });
      }
      continue;
    }
    stats[present ? 'overwritten' : 'added'] += 1;
    operations.push(() => {
      if (present) backupFile(target, backupRoot, label);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, item.content);
      chmodSync(target, targetMode);
    });
  }
  for (const label of ownedBefore) {
    if (desired.has(label)) continue;
    const target = ownedPath(claudeDir, label);
    if (!existsSync(target)) continue;
    if (!lstatSync(target).isFile()) throw new Error(`Expected an owned regular file: ${target}`);
    const currentHash = hashFile(target);
    // Upgrade old manifests conservatively: prune only files still matching the repository.
    const hasBaseline = Object.hasOwn(oldHashes, label);
    const knownHash = typeof oldHashes[label] === 'string' ? oldHashes[label] : null;
    const repositoryPath = join(repoDir, label);
    const legacyMatch = !hasBaseline && existsSync(repositoryPath) && lstatSync(repositoryPath).isFile() && hashFile(repositoryPath) === currentHash;
    const expectedHash = knownHash || (legacyMatch ? currentHash : null);
    const currentMode = fileMode(target);
    const knownMode = knownFileMode(oldModes, label);
    const sourceMode = existsSync(repositoryPath) && lstatSync(repositoryPath).isFile() ? fileMode(repositoryPath) : null;
    const expectedMode = Object.hasOwn(oldModes, label) ? knownMode
      : (currentMode === sourceMode || currentMode === 0o644 ? currentMode : null);
    if (!prune || currentHash !== expectedHash || expectedMode === null || currentMode !== expectedMode) {
      nextHashes[label] = expectedHash;
      nextModes[label] = expectedMode;
      retained.push(label);
      stats.preserved += 1;
      continue;
    }
    stats.pruned += 1;
    operations.push(() => { backupFile(target, backupRoot, label); rmSync(target); });
  }
  const launcherPath = join(binDir, 'vibeco');
  assertSafePath(dirname(launcherPath), dirname(dirname(binDir)));
  const launcher = `#!/bin/sh\nexec node ${shellQuote(join(claudeDir, 'tools', 'vibeco', 'vibeco.mjs'))} "$@"\n`;
  let launcherHash = previousState.cliLauncherHash;
  let launcherStat;
  try { launcherStat = lstatSync(launcherPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const launcherPresent = Boolean(launcherStat);
  const launcherRegular = launcherStat?.isFile();
  if (!launcherPresent || (launcherRegular && (force || hashFile(launcherPath) === previousState.cliLauncherHash))) {
    launcherHash = hash(launcher);
    if (!launcherPresent || hashFile(launcherPath) !== launcherHash) operations.push(() => {
      if (launcherPresent) backupFile(launcherPath, backupRoot, 'cli/vibeco');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(launcherPath, launcher, { mode: 0o755 });
      chmodSync(launcherPath, 0o755);
    });
  } else { stats.conflicts += 1; stats.skipped += 1; }
  const nextState = { ...previousState, repoDir, activeProfile: runtime.profile, requestedProfile: runtime.requestedProfile, contextBudget: runtime.contextBudget, ownedFiles: Object.keys(nextHashes), ownedFileHashes: nextHashes, ownedFileModes: nextModes, retainedFiles: retained, cliLauncherHash: launcherHash, ownedHookKeys: merged.ownedHookKeys, registeredHookCommands: merged.registeredHookCommands, updatedAt: new Date().toISOString() };
  const nextConfig = { ...pluginConfig, activeProfile: runtime.profile, vibecosystem: { profile: runtime.profile, requestedProfile: runtime.requestedProfile, enabledAgents: runtime.agents, enabledSkills: runtime.skills, enabledRules: runtime.rules, enabledHooks: runtime.hooks, contextBudget: runtime.contextBudget, updatedAt: nextState.updatedAt } };
  if (!dryRun) {
    mkdirSync(claudeDir, { recursive: true });
    for (const operation of operations) operation();
    for (const [path, value] of [[settingsPath, merged.settings], [configPath, nextConfig], [statePath, nextState]]) {
      const content = `${JSON.stringify(value, null, 2)}\n`;
      if (existsSync(path) && readFileSync(path, 'utf8') === content) continue;
      if (existsSync(path)) backupFile(path, backupRoot, basename(path));
      writeFileSync(path, content);
    }
    // Remove empty managed directories without touching directories containing user files.
    for (const label of ownedBefore) {
      let path = dirname(ownedPath(claudeDir, label));
      while (path !== claudeDir && path.startsWith(`${claudeDir}${sep}`) && existsSync(path) && !readdirSync(path).length) { rmSync(path, { recursive: true }); path = dirname(path); }
    }
  }
  console.log(`vibecosystem profile: ${runtime.profile}`);
  console.log(`  agents=${agentNames.length} skills=${skillNames.length} rules=${ruleNames.length} hooks=${hookNames.length}`);
  console.log(`  added=${stats.added} overwritten=${stats.overwritten} unchanged=${stats.unchanged} skipped=${stats.skipped} conflicts=${stats.conflicts} pruned=${stats.pruned} preserved=${stats.preserved} modesUpdated=${stats.modesUpdated}`);
  if (retained.length) console.log(`  ${retained.length} modified or retained owned files remain installed; review retainedFiles in vibecosystem-runtime.json.`);
  if (stats.conflicts) console.log('  Existing or modified user files were preserved. Use --force only when intentional.');
  if (dryRun) console.log('  dry-run: no files or settings were changed.');
  return { runtime, stats, state: nextState };
}

function parseArgs(argv) {
  const options = { profile: 'core', force: false, prune: true, dryRun: false, nonInteractive: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--profile') { const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error('--profile requires a value'); options.profile = value; }
    else if (arg.startsWith('--profile=')) options.profile = arg.slice(10);
    else if (arg === '--force') options.force = true;
    else if (arg === '--prune') options.prune = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--non-interactive') options.nonInteractive = true;
    else if (arg !== '--claude') throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { installClaude({ repoDir: process.env.VIBECO_REPO_DIR || DEFAULT_REPO_DIR, ...parseArgs(process.argv.slice(2)) }); }
  catch (error) { console.error(`vibecosystem install failed: ${error.message}`); process.exitCode = 1; }
}
