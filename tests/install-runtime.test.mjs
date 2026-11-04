import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { installClaude } from '../tools/install-runtime.mjs';
import { mergeOwnedHooks } from '../tools/register-hooks.mjs';
import { resolveProfile } from '../tools/profile-runtime.mjs';

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "vibeco user's home "));
  roots.push(home);
  const claudeDir = join(home, '.claude');
  const binDir = join(home, '.local', 'bin');
  const install = (options = {}) => installClaude({ repoDir, claudeDir, binDir, nonInteractive: true, ...options });
  return { home, claudeDir, binDir, install };
}
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const commands = (settings) => Object.values(settings.hooks).flatMap((groups) => groups.flatMap((group) => group.hooks.map((hook) => hook.command)));

test('dry-run writes nothing; installed CLI and quoted hook paths work in homes with spaces and apostrophes', () => {
  const f = fixture();
  f.install({ dryRun: true });
  assert.deepEqual(readdirSync(f.home), []);
  f.install();
  const output = execFileSync(join(f.binDir, 'vibeco'), ['help'], { env: { ...process.env, HOME: f.home }, encoding: 'utf8' });
  assert.match(output, /vibecosystem/);
  for (const command of commands(json(join(f.claudeDir, 'settings.json')))) execFileSync('/bin/sh', ['-c', command.replace(/^node /, 'node --check ')]);
  execFileSync(join(f.binDir, 'vibeco'), ['profile', 'quality'], { env: { ...process.env, HOME: f.home }, encoding: 'utf8' });
  assert.equal(json(join(f.claudeDir, 'vibecosystem-runtime.json')).activeProfile, 'quality');
});

test('ordinary full to core profile switches reconcile stale owned files and preserve user hooks and edited files', () => {
  const f = fixture();
  f.install({ profile: 'full' });
  const edited = join(f.claudeDir, 'agents', 'api-designer.md');
  writeFileSync(edited, 'user customization');
  const settingsPath = join(f.claudeDir, 'settings.json');
  const settings = json(settingsPath);
  settings.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user-owned' }] });
  writeFileSync(settingsPath, JSON.stringify(settings));
  const result = f.install();
  assert.equal(readFileSync(edited, 'utf8'), 'user customization');
  assert.ok(result.state.retainedFiles.includes('agents/api-designer.md'));
  assert.equal(existsSync(join(f.claudeDir, 'agents', 'aws-expert.md')), false);
  const registered = commands(json(settingsPath));
  assert.equal(registered.filter((x) => x === 'echo user-owned').length, 1);
  assert.equal(registered.length, result.state.registeredHookCommands + 1);
  assert.equal(readdirSync(join(f.claudeDir, 'hooks', 'dist')).length, resolveProfile(repoDir).hooks.length);
});

test('selected modified files survive updates; force backs up and replaces them', () => {
  const f = fixture();
  f.install();
  const file = join(f.claudeDir, 'agents', 'architect.md');
  writeFileSync(file, 'custom');
  assert.ok(f.install().stats.conflicts > 0);
  assert.equal(readFileSync(file, 'utf8'), 'custom');
  f.install({ force: true });
  assert.equal(readFileSync(file, 'utf8'), readFileSync(join(repoDir, 'agents', 'architect.md'), 'utf8'));
  const backups = readdirSync(join(f.claudeDir, 'backups'));
  assert.ok(backups.some((name) => { const path = join(f.claudeDir, 'backups', name, 'agents', 'architect.md'); return existsSync(path) && readFileSync(path, 'utf8') === 'custom'; }));
  assert.equal(f.install().stats.overwritten, 0);
});

test('invalid settings and malicious ownership paths fail before any install writes', () => {
  const f = fixture();
  mkdirSync(f.claudeDir);
  writeFileSync(join(f.claudeDir, 'settings.json'), '{broken');
  assert.throws(() => f.install(), /JSON/);
  assert.deepEqual(readdirSync(f.claudeDir), ['settings.json']);
  writeFileSync(join(f.claudeDir, 'settings.json'), '{}');
  writeFileSync(join(f.claudeDir, 'vibecosystem-runtime.json'), JSON.stringify({ ownedFiles: ['../../outside'] }));
  assert.throws(() => f.install(), /ownership manifest/);
  assert.equal(existsSync(join(f.claudeDir, 'agents')), false);
});

test('nested destination symlinks cannot overwrite an external directory', () => {
  const f = fixture();
  const outside = join(f.home, 'outside');
  mkdirSync(outside);
  mkdirSync(f.claudeDir);
  symlinkSync(outside, join(f.claudeDir, 'agents'));
  assert.throws(() => f.install(), /symlink/);
  assert.deepEqual(readdirSync(outside), []);
});

test('pre-existing identical user hooks are never claimed or later pruned', () => {
  const command = "node '/home/test/.claude'/hooks/dist/test.mjs";
  const settings = { hooks: { Stop: [{ hooks: [{ type: 'command', command }] }] } };
  const manifest = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/hooks/dist/test.mjs' }] }] } };
  const first = mergeOwnedHooks({ manifest, settings, claudeDir: '/home/test/.claude' });
  assert.deepEqual(first.ownedHookKeys, []);
  const next = mergeOwnedHooks({ manifest: { hooks: {} }, settings: first.settings, claudeDir: '/home/test/.claude', ownedHookKeys: first.ownedHookKeys });
  assert.deepEqual(commands(next.settings), [command]);
});

test('remote installer preserves a checkout when pull fails', () => {
  const f = fixture();
  const installDir = join(f.home, '.vibecosystem');
  const mockBin = join(f.home, 'mock-bin');
  mkdirSync(join(installDir, '.git'), { recursive: true });
  mkdirSync(mockBin);
  writeFileSync(join(installDir, 'keep.txt'), 'local data');
  const git = `#!/bin/sh\ncase "$*" in\n  *status*) exit 0;;\n  *get-url*) echo https://github.com/vibeeval/vibecosystem.git; exit 0;;\n  *pull*) exit 1;;\n  *) exit 99;;\nesac\n`;
  writeFileSync(join(mockBin, 'git'), git, { mode: 0o755 });
  const result = spawnSync('bash', [join(repoDir, 'install-remote.sh')], { env: { ...process.env, HOME: f.home, PATH: `${mockBin}:${process.env.PATH}` }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /preserved/);
  assert.equal(readFileSync(join(installDir, 'keep.txt'), 'utf8'), 'local data');
});


test('Codex updates unchanged owned skills, preserves edits and prunes only unchanged stale skills', () => {
  const f = fixture();
  const source = join(f.home, 'source');
  mkdirSync(join(source, 'tools'), { recursive: true });
  mkdirSync(join(source, 'profiles'));
  for (const name of ['one', 'two']) {
    mkdirSync(join(source, 'skills', name), { recursive: true });
    writeFileSync(join(source, 'skills', name, 'SKILL.md'), `original ${name}`);
  }
  copyFileSync(join(repoDir, 'install-codex.sh'), join(source, 'install-codex.sh'));
  copyFileSync(join(repoDir, 'tools', 'profile-runtime.mjs'), join(source, 'tools', 'profile-runtime.mjs'));
  writeFileSync(join(source, 'profiles', 'runtime-manifest.json'), JSON.stringify({ profiles: { core: { skills: ['one'] }, full: { skills: 'all' } } }));
  const run = (profile = 'core') => execFileSync('bash', [join(source, 'install-codex.sh'), '--profile', profile, '--non-interactive'], { env: { ...process.env, HOME: f.home }, encoding: 'utf8' });
  run('full');
  const target = join(f.home, '.agents', 'skills', 'one', 'SKILL.md');
  writeFileSync(join(source, 'skills', 'one', 'SKILL.md'), 'updated one');
  run();
  assert.equal(readFileSync(target, 'utf8'), 'updated one');
  assert.equal(existsSync(join(f.home, '.agents', 'skills', 'two')), false);
  writeFileSync(target, 'custom user edit');
  writeFileSync(join(source, 'skills', 'one', 'SKILL.md'), 'next update');
  run();
  assert.equal(readFileSync(target, 'utf8'), 'custom user edit');
  const stale = join(f.home, '.agents', 'skills', 'two');
  mkdirSync(stale);
  writeFileSync(join(stale, 'SKILL.md'), 'custom unverified stale');
  const ownership = join(f.home, '.agents', '.vibecosystem-codex-skills');
  writeFileSync(ownership, 'one\tunverified\ntwo\tunverified\n');
  for (let iteration = 0; iteration < 3; iteration += 1) {
    run();
    assert.equal(readFileSync(target, 'utf8'), 'custom user edit');
    assert.equal(readFileSync(join(stale, 'SKILL.md'), 'utf8'), 'custom unverified stale');
    assert.match(readFileSync(ownership, 'utf8'), /one\tunverified/);
  }
  for (const name of ['.', '..']) {
    writeFileSync(ownership, `${name}\tunverified\n`);
    const result = spawnSync('bash', [join(source, 'install-codex.sh'), '--dry-run', '--non-interactive'], { env: { ...process.env, HOME: f.home }, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /invalid skill name in ownership manifest/);
    assert.equal(readFileSync(target, 'utf8'), 'custom user edit');
  }
  // Pruning the last owned entry must work under macOS Bash 3.2 + set -u.
  const fileDigest = createHash('sha256').update(readFileSync(join(stale, 'SKILL.md'))).digest('hex');
  const treeDigest = createHash('sha256').update(`${fileDigest}  ./SKILL.md\n`).digest('hex');
  writeFileSync(ownership, `two\t${treeDigest}\n`);
  run();
  assert.equal(existsSync(stale), false);
  assert.equal(readFileSync(target, 'utf8'), 'custom user edit');
});


test('public init rejects misspelled flags and invalid profiles before writing', () => {
  const f = fixture();
  for (const args of [['init', '--froce'], ['init', '--profile', 'missing'], ['init', '--profile']]) {
    const result = spawnSync(process.execPath, [join(repoDir, 'bin', 'cli.mjs'), ...args], { env: { ...process.env, HOME: f.home }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown init argument|Invalid profile|requires a value/);
    assert.deepEqual(readdirSync(f.home), []);
  }
});


test('legacy unhashed selected and retired edited files remain conflicts across repeated installs', () => {
  const f = fixture();
  f.install({ profile: 'full' });
  const selected = join(f.claudeDir, 'agents', 'architect.md');
  const stale = join(f.claudeDir, 'agents', 'api-designer.md');
  const retired = join(f.claudeDir, 'agents', 'retired-legacy-agent.md');
  for (const file of [selected, stale, retired]) writeFileSync(file, 'custom legacy content');
  const statePath = join(f.claudeDir, 'vibecosystem-runtime.json');
  const state = json(statePath);
  delete state.ownedFileHashes;
  state.ownedFiles.push('agents/retired-legacy-agent.md');
  writeFileSync(statePath, JSON.stringify(state));
  for (let run = 0; run < 3; run += 1) {
    const result = f.install();
    for (const file of [selected, stale, retired]) {
      assert.equal(readFileSync(file, 'utf8'), 'custom legacy content');
      const label = `agents/${file.split('/').at(-1)}`;
      assert.equal(result.state.ownedFileHashes[label], null);
      assert.ok(result.state.retainedFiles.includes(label));
    }
  }
  f.install({ force: true });
  assert.equal(readFileSync(selected, 'utf8'), readFileSync(join(repoDir, 'agents', 'architect.md'), 'utf8'));
  assert.equal(readFileSync(stale, 'utf8'), 'custom legacy content');
  assert.equal(readFileSync(retired, 'utf8'), 'custom legacy content');
});


test('remote installer forwards explicit flags and dry-run skips Git/runtime writes', () => {
  const f = fixture();
  const checkout = join(f.home, '.vibecosystem');
  const mockBin = join(f.home, 'mock-bin');
  mkdirSync(join(checkout, '.git'), { recursive: true });
  mkdirSync(mockBin);
  writeFileSync(join(checkout, 'install.sh'), '#!/bin/sh\nprintf "ARG:%s\\n" "$@"\n');
  writeFileSync(join(mockBin, 'git'), '#!/bin/sh\ncase "$*" in\n  *get-url*) echo https://github.com/vibeeval/vibecosystem.git;;\n  *status*) exit 0;;\n  *pull*) echo GIT_PULL;;\n  *) exit 99;;\nesac\n', { mode: 0o755 });
  const run = (args) => spawnSync('bash', [join(repoDir, 'install-remote.sh'), ...args], { env: { ...process.env, HOME: f.home, PATH: `${mockBin}:${process.env.PATH}` }, encoding: 'utf8' });
  const dry = run(['--profile', 'full', '--dry-run', '--force', '--prune', '--non-interactive']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /ARG:--profile\nARG:full\nARG:--dry-run\nARG:--force\nARG:--prune\nARG:--non-interactive/);
  assert.doesNotMatch(dry.stdout, /GIT_PULL|Choose a profile/);
  assert.equal(existsSync(f.claudeDir), false);
  assert.equal(existsSync(f.binDir), false);
  const actual = run(['--profile=quality', '--non-interactive']);
  assert.equal(actual.status, 0, actual.stderr);
  assert.match(actual.stdout, /GIT_PULL/);
  assert.match(actual.stdout, /ARG:--profile=quality\nARG:--non-interactive/);
  assert.doesNotMatch(actual.stdout, /Choose a profile/);
  assert.equal(run(['--froce']).status, 1);
  assert.equal(run(['--profile', 'invalid']).status, 1);
  rmSync(checkout, { recursive: true });
  const cleanDry = run(['--profile', 'full', '--dry-run']);
  assert.equal(cleanDry.status, 0, cleanDry.stderr);
  assert.match(cleanDry.stdout, /would clone.*profile full/);
  assert.equal(existsSync(checkout), false);
  assert.equal(existsSync(f.claudeDir), false);
});


test('public dashboard profile installs its bundle and both event registrations without changing core', () => {
  const f = fixture();
  execFileSync(process.execPath, [join(repoDir, 'bin', 'cli.mjs'), 'init', '--profile', 'dashboard'], { env: { ...process.env, HOME: f.home }, encoding: 'utf8' });
  const state = json(join(f.claudeDir, 'vibecosystem-runtime.json'));
  assert.equal(state.activeProfile, 'dashboard');
  const settings = json(join(f.claudeDir, 'settings.json'));
  const emitter = (group) => group.hooks.some((hook) => hook.command.includes('/dashboard-ws-emitter.mjs'));
  assert.ok(settings.hooks.PreToolUse.some((group) => emitter(group) && group.matcher === 'Agent|Task'));
  assert.ok(settings.hooks.PostToolUse.some(emitter));
  assert.equal(commands(settings).filter((command) => command.includes('/dashboard-ws-emitter.mjs')).length, 2);
  assert.equal(readFileSync(join(f.claudeDir, 'hooks', 'dist', 'dashboard-ws-emitter.mjs'), 'utf8'), readFileSync(join(repoDir, 'hooks', 'dist', 'dashboard-ws-emitter.mjs'), 'utf8'));
  f.install();
  assert.equal(commands(json(join(f.claudeDir, 'settings.json'))).some((command) => command.includes('/dashboard-ws-emitter.mjs')), false);
});


test('executable source modes survive install, legacy repair and replacement without changing custom modes', () => {
  const f = fixture();
  const source = join(f.home, 'mode-source');
  for (const dir of ['profiles', 'agents', 'skills/runner', 'rules', 'hooks/dist', 'tools/vibeco', 'tools/dashboard']) mkdirSync(join(source, dir), { recursive: true });
  for (const name of ['install-runtime.mjs', 'profile-runtime.mjs', 'register-hooks.mjs']) copyFileSync(join(repoDir, 'tools', name), join(source, 'tools', name));
  writeFileSync(join(source, 'profiles', 'runtime-manifest.json'), JSON.stringify({ profiles: { core: { agents: [], skills: ['runner'], rules: [], hooks: [] } } }));
  writeFileSync(join(source, 'hooks', 'hooks.json'), JSON.stringify({ hooks: {} }));
  writeFileSync(join(source, 'skills', 'runner', 'SKILL.md'), '# Runnable fixture');
  const sourceScript = join(source, 'skills', 'runner', 'run.sh');
  const label = 'skills/runner/run.sh';
  writeFileSync(sourceScript, '#!/bin/sh\nprintf "script-v1"\n', { mode: 0o755 });
  const target = join(f.claudeDir, label);
  const mode = (path) => lstatSync(path).mode & 0o777;
  const install = (options = {}) => f.install({ repoDir: source, ...options });
  const direct = () => execFileSync(target, [], { env: { ...process.env, HOME: f.home }, encoding: 'utf8' });
  const backupMatches = (content, expectedMode) => readdirSync(join(f.claudeDir, 'backups')).some((name) => {
    const path = join(f.claudeDir, 'backups', name, label);
    return existsSync(path) && readFileSync(path, 'utf8') === content && mode(path) === expectedMode;
  });
  install();
  assert.equal(mode(target), 0o755);
  assert.equal(direct(), 'script-v1');
  assert.equal(mode(join(f.claudeDir, 'skills', 'runner', 'SKILL.md')), mode(join(source, 'skills', 'runner', 'SKILL.md')));

  // Simulate a pre-fix install: correct owned bytes, stripped permissions, no mode ledger.
  chmodSync(target, 0o644);
  const statePath = join(f.claudeDir, 'vibecosystem-runtime.json');
  const state = json(statePath);
  delete state.ownedFileModes;
  writeFileSync(statePath, JSON.stringify(state));
  assert.equal(install().stats.modesUpdated, 1);
  assert.equal(mode(target), 0o755);
  assert.equal(direct(), 'script-v1');
  assert.ok(backupMatches(readFileSync(sourceScript, 'utf8'), 0o644));

  const previousContent = readFileSync(target, 'utf8');
  writeFileSync(sourceScript, '#!/bin/sh\nprintf "script-v2"\n');
  install();
  assert.equal(mode(target), 0o755);
  assert.equal(direct(), 'script-v2');
  assert.ok(backupMatches(previousContent, 0o755));

  // A deliberate user mode change is retained across repeated owned updates.
  chmodSync(target, 0o700);
  for (let run = 0; run < 2; run += 1) { install(); assert.equal(mode(target), 0o700); }
  const customContent = '#!/bin/sh\nprintf "user-owned"\n';
  writeFileSync(target, customContent);
  chmodSync(target, 0o600);
  install();
  assert.equal(readFileSync(target, 'utf8'), customContent);
  assert.equal(mode(target), 0o600);
  install({ force: true });
  assert.equal(direct(), 'script-v2');
  assert.equal(mode(target), 0o755);
  assert.ok(backupMatches(customContent, 0o600));

  // Execute permissions follow source mode; they are never added to ordinary files.
  chmodSync(sourceScript, 0o644);
  install();
  assert.equal(mode(target), 0o644);
  assert.equal(spawnSync(target).error?.code, 'EACCES');

  const unmanaged = fixture();
  const unmanagedTarget = join(unmanaged.claudeDir, label);
  mkdirSync(dirname(unmanagedTarget), { recursive: true });
  writeFileSync(unmanagedTarget, customContent, { mode: 0o700 });
  unmanaged.install({ repoDir: source });
  assert.equal(readFileSync(unmanagedTarget, 'utf8'), customContent);
  assert.equal(mode(unmanagedTarget), 0o700);
});
