import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

test('packed npm layout installs and runs core plus opt-in bundles without source node_modules', () => {
  // Canonical paths expose imported-CLI side effects on macOS as on Linux.
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'vibeco-package-')));
  try {
    const home = join(fixture, 'home');
    const project = join(fixture, 'project');
    mkdirSync(home);
    mkdirSync(project);
    const env = { HOME: home, PATH: process.env.PATH, npm_config_cache: join(fixture, 'npm-cache') };
    const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', fixture],
      { cwd: root, env, encoding: 'utf8', timeout: 30_000 }))[0];
    assert(!packed.files.some(file => file.path.includes('node_modules/')));
    assert(packed.files.some(file => file.path === '.codex/agents/luna-worker.toml'));
    execFileSync('tar', ['-xzf', join(fixture, packed.filename), '-C', fixture]);
    const packageRoot = join(fixture, 'package');
    const metadata = readJson(join(packageRoot, 'package.json'));
    assert.equal(metadata.version, readJson(join(root, 'plugin.json')).version);
    assert.equal(metadata.version, readJson(join(root, 'marketplace.json')).version);
    for (const path of Object.values(metadata.bin)) assert(existsSync(join(packageRoot, path)));
    const run = (path, args = [], input) => {
      const result = spawnSync(process.execPath, [path, ...args], {
        cwd: project, env: { HOME: home, PATH: '', CLAUDE_PROJECT_DIR: project },
        input: input && JSON.stringify(input), encoding: 'utf8', timeout: 10_000,
      });
      assert.equal(result.status, 0, `${path}\nstdout: ${result.stdout.slice(0, 2000)}\nstderr: ${result.stderr.slice(0, 2000)}`);
      assert.doesNotMatch(result.stderr, /require is not defined|Dynamic require|ERR_MODULE_NOT_FOUND|ReferenceError/);
      return result;
    };
    run(join(packageRoot, 'bin/cli.mjs'), ['init', '--profile', 'core']);
    assert(statSync(join(home, '.claude/skills/strategic-compact/suggest-compact.sh')).mode & 0o111,
      'packed core helper must retain direct-execution permissions');
    assert.match(run(join(packageRoot, 'bin/cli.mjs'), ['doctor']).stdout, /0 failed/);
    const cli = join(home, '.claude/tools/vibeco/vibeco.mjs');
    assert.match(run(cli, ['version']).stdout, new RegExp(metadata.version.replaceAll('.', '\\.')));
    const statePath = join(home, '.claude/vibecosystem-runtime.json');
    const stateBeforeInvalidProfile = readFileSync(statePath, 'utf8');
    const invalidProfile = spawnSync(process.execPath, [cli, 'profile', 'not-a-profile'], {
      cwd: project, env: { HOME: home, PATH: '' }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(invalidProfile.status, 1);
    assert.equal(readFileSync(statePath, 'utf8'), stateBeforeInvalidProfile);
    const manifest = readJson(join(home, '.claude/hooks/hooks.json'));
    const input = { session_id: 'packed-test', cwd: project, tool_use_id: 'read-1',
      tool_name: 'Read', tool_input: { file_path: join(project, 'safe.txt') },
      tool_response: { type: 'text', file: { content: 'synthetic result' } } };
    for (const [event, groups] of Object.entries(manifest.hooks)) {
      for (const group of groups) for (const hook of group.hooks) {
        const name = /\/dist\/([^/]+\.mjs)/.exec(hook.command)?.[1];
        assert(name, hook.command);
        const output = run(join(home, '.claude/hooks/dist', name), [], { ...input, hook_event_name: event });
        if (output.stdout.trim()) JSON.parse(output.stdout);
      }
    }
    const denied = JSON.parse(run(join(home, '.claude/hooks/dist/credential-deny.mjs'), [], {
      ...input, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'cat .env' },
    }).stdout);
    assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
    const tokens = readFileSync(join(home, '.claude/token-usage.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert(tokens.some(entry => entry.output_chars === 'synthetic result'.length));

    // Exercise optional code from the installed layout, not a dev dependency tree.
    run(cli, ['profile', 'full']);
    const hooks = join(home, '.claude/hooks/dist');
    for (const name of ['mcp-discovery', 'plugin-registry', 'smart-memory-recall',
      'pre-tool-use-broadcast', 'handoff-index']) {
      run(join(hooks, `${name}.mjs`), name === 'plugin-registry' ? ['status'] : [], {
        ...input, tool_name: 'Unknown', prompt: 'unrelated fixture',
      });
    }
    const memory = run(join(hooks, 'memory-graph.mjs'), [], input);
    assert.match(memory.stderr, /optional better-sqlite3|better-sqlite3.*unavailable/i);
    run(cli, ['profile', 'core']);
    assert(!existsSync(join(hooks, 'memory-graph.mjs')));
    assert.equal(readJson(join(home, '.claude/vibecosystem-runtime.json')).activeProfile, 'core');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
