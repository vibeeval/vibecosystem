import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise real bundled producers. Only the external TLDR daemon boundary is
// replaced; no optional tools, daemon startup or live user caches are used.
describe('bounded context-profile producer output', () => {
  let bundles: string;
  let directory: string;
  let home: string;
  let project: string;
  beforeAll(async () => {
    bundles = mkdtempSync(join(tmpdir(), 'context-producer-bundles-'));
    await build({
      entryPoints: ['tldr-read-enforcer', 'smart-search-router'].map(name => resolve('src', `${name}.ts`)),
      outdir: bundles, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm',
      plugins: [{
        name: 'isolated-tldr-daemon-fixture',
        setup(builder) {
          builder.onResolve({ filter: /daemon-client\.js$/ }, () => ({ path: 'daemon', namespace: 'fixture' }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `
            import { readFileSync } from 'node:fs';
            export function queryDaemonSync(query) {
              const fixture = JSON.parse(readFileSync(process.env.TLDR_FIXTURE, 'utf8'));
              return fixture[query.cmd] || { status: 'ok', results: [], callers: [] };
            }
            export function trackHookActivitySync() {}
          ` }));
        },
      }],
    });
  });
  afterAll(() => rmSync(bundles, { recursive: true, force: true }));
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'context-producer-fixture-'));
    home = join(directory, 'home');
    project = join(directory, 'project');
    mkdirSync(home);
    mkdirSync(project);
    // Relative path keeps the hook's explicit /tmp-source bypass out of this test.
    writeFileSync(join(project, 'large.py'), '# local source\n'.repeat(400));
    mkdirSync(join(project, '.tldr/cache/semantic'), { recursive: true });
    writeFileSync(join(project, '.tldr/cache/semantic/index.faiss'), 'synthetic index marker');
    writeFileSync(join(directory, 'daemon.json'), JSON.stringify({
      extract: { status: 'ok', result: { functions: [{ name: 'source_'.repeat(2000), line: 1 }] } },
      semantic: { status: 'ok', results: [{ file: `source_${'x'.repeat(6000)}.py`, function: 'handler', score: 0.9 }] },
    }));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function run(name: string, input: Record<string, unknown>, perEventChars = 64, sessionChars = 64) {
    const runtime = join(directory, 'runtime.json');
    writeFileSync(runtime, JSON.stringify({ contextBudget: { perEventChars, sessionChars } }));
    const result = spawnSync(process.execPath, [join(bundles, `${name}.mjs`)], {
      input: JSON.stringify({ session_id: 'fixture-session', tool_use_id: 'fixture-tool', cwd: project, ...input }),
      cwd: project, encoding: 'utf8', timeout: 5000,
      env: { HOME: home, PATH: '', CLAUDE_PROJECT_DIR: project,
        VIBECO_CONTEXT_BUDGET_PATH: join(directory, 'budget.json'), VIBECO_RUNTIME_PATH: runtime,
        TLDR_FIXTURE: join(directory, 'daemon.json') },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    return JSON.parse(result.stdout).hookSpecificOutput;
  }
  const cases = [
    { name: 'tldr-read-enforcer', input: { tool_name: 'Read', tool_input: { file_path: 'large.py' } } },
    { name: 'smart-search-router', input: { tool_name: 'Grep', tool_input: { pattern: 'literal_'.repeat(1000) } } },
    { name: 'smart-search-router', input: { tool_name: 'Grep', tool_input: { pattern: `def ${'structural_'.repeat(1000)}` } } },
    { name: 'smart-search-router', input: { tool_name: 'Grep', tool_input: { pattern: 'where is the authentication handler' } } },
  ];
  it.each(cases)('caps retrieved/suggested text in $name without forcing optional search tools', ({ name, input }) => {
    const output = run(name, input);
    expect(output.hookEventName).toBe('PreToolUse');
    if (name === 'tldr-read-enforcer') {
      expect(output.permissionDecision).toBe('deny');
      expect(output.permissionDecisionReason.length).toBeLessThan(150);
    } else {
      expect(output).not.toHaveProperty('permissionDecision');
      expect(output).not.toHaveProperty('permissionDecisionReason');
    }
    expect(output.additionalContext.length).toBeGreaterThan(0);
    expect(output.additionalContext.length).toBeLessThanOrEqual(64);
    expect(JSON.stringify(output)).not.toMatch(/\d+% token savings/);
    expect(output).not.toHaveProperty('updatedInput');
  });
  it.each(cases)('leaves the original tool available when $name has no advisory budget', ({ name, input }) => {
    expect(run(name, input, 0, 0)).toBeUndefined();
  });
  it('shares the session cap between separate Read and Grep producer processes', () => {
    const first = run('smart-search-router', { tool_name: 'Grep', tool_input: { pattern: 'authenticate' } }, 32, 40);
    const second = run('tldr-read-enforcer', {
      tool_use_id: 'second-tool', tool_name: 'Read', tool_input: { file_path: 'large.py' },
    }, 32, 40);
    expect(first.additionalContext.length).toBe(32);
    expect(second.additionalContext.length).toBe(8);
    expect(first).not.toHaveProperty('permissionDecision');
    expect(second.permissionDecision).toBe('deny');
    // Once both replacements have exhausted the session budget, routing cannot
    // block a later source read with an empty replacement.
    expect(run('tldr-read-enforcer', {
      tool_use_id: 'third-tool', tool_name: 'Read', tool_input: { file_path: 'large.py' },
    }, 32, 40)).toBeUndefined();
  });
  it('allows the original Read when the optional daemon has no retrieved context', () => {
    writeFileSync(join(directory, 'daemon.json'), JSON.stringify({ extract: { status: 'unavailable' } }));
    expect(run('tldr-read-enforcer', { tool_name: 'Read', tool_input: { file_path: 'large.py' } })).toBeUndefined();
  });
  it('stores router context inside isolated HOME using hashed session and project keys', () => {
    run('smart-search-router', { session_id: '../../outside', tool_name: 'Grep', tool_input: { pattern: 'authenticate' } });
    const cache = join(home, '.claude/cache/search-context');
    const entries = readdirSync(cache);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^[a-f0-9]{64}\.json$/);
    expect(JSON.parse(readFileSync(join(cache, entries[0]), 'utf8')).pattern).toBe('authenticate');
  });
});
