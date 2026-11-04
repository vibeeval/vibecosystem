import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildSync } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

describe('bundled agent-memory path boundaries', () => {
  let bundles: string;
  let fixture: string;
  let home: string;
  let project: string;
  const response = 'Root cause: concurrent cache writes caused stale state. Fixed issue by serializing all cache updates.';
  const secret = 'SYNTHETIC_MEMORY_PATH_SECRET';

  beforeAll(() => {
    bundles = mkdtempSync(join(tmpdir(), 'memory-path-bundles-'));
    buildSync({
      entryPoints: ['agent-memory-loader', 'agent-memory-saver'].map(name => resolve('src', `${name}.ts`)),
      bundle: true, platform: 'node', format: 'esm', outdir: bundles,
      outExtension: { '.js': '.mjs' }, logLevel: 'silent',
    });
  });
  afterAll(() => rmSync(bundles, { recursive: true, force: true }));
  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'memory-path-fixture-'));
    home = join(fixture, 'home');
    project = join(fixture, 'project');
    mkdirSync(home);
    mkdirSync(project);
  });
  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  function file(path: string, contents: string): void {
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, contents);
  }

  function scope(value: string): void {
    file(join(home, '.claude', 'agents', 'scout.md'), `---\nname: scout\nmemory: ${value}\n---\n`);
  }

  function memoryDir(value: string): string {
    return join(value === 'user' ? home : project, '.claude', value === 'local' ? 'agent-memory-local' : 'agent-memory', 'scout');
  }

  function run(hook: 'loader' | 'saver', env: Record<string, string> = {}): string {
    const result = spawnSync(process.execPath, [join(bundles, `agent-memory-${hook}.mjs`)], {
      input: JSON.stringify({
        cwd: project, session_id: 'memory-path-fixture', tool_name: 'Agent',
        tool_input: { subagent_type: 'scout', description: 'Cache repair' },
        tool_response: { content: [{ type: 'text', text: response }] },
      }),
      cwd: project, env: { HOME: home, PATH: '', ...env }, encoding: 'utf-8', timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  }

  it.each(['user', 'project', 'local'])('preserves regular-file save, append, load and bounded retention in %s scope', value => {
    scope(value);
    const journal = join(memoryDir(value), 'learnings.md');
    file(journal, 'old entry\n' + 'a'.repeat(51_000));
    run('saver');
    const first = readFileSync(journal, 'utf-8');
    expect(first).toContain('Root cause');
    expect(first.length).toBeLessThan(50_000);
    run('saver');
    const second = readFileSync(journal, 'utf-8');
    expect(second.startsWith(first)).toBe(true);
    expect(second.match(/Root cause/g)).toHaveLength(2);
    const output = run('loader');
    expect(output).toContain('Root cause');
    expect(output).toContain('scope: ' + value);
    expect(existsSync(join(memoryDir(value), 'MEMORY.md'))).toBe(true);
  });

  it.each(['user', 'project', 'local'])('does not read or truncate symlinked files in %s scope', value => {
    scope(value);
    const dir = memoryDir(value);
    mkdirSync(dir, { recursive: true });
    const external = join(fixture, 'outside-notes.md');
    const original = 'OUTSIDE_PREFIX\n' + 's'.repeat(68_000);
    file(external, original);
    file(join(project, '.env'), secret);
    file(join(dir, 'valid.md'), 'SAFE_MEMORY_MARKER');
    symlinkSync(external, join(dir, 'learnings.md'));
    symlinkSync(join(project, '.env'), join(dir, 'credential.md'));
    const output = run('loader');
    expect(output).toContain('SAFE_MEMORY_MARKER');
    expect(output).not.toContain(secret);
    expect(output).not.toContain('OUTSIDE_PREFIX');
    run('saver');
    expect(readFileSync(external, 'utf-8')).toBe(original);
    expect(readFileSync(join(project, '.env'), 'utf-8')).toBe(secret);
  });

  it.each(['user', 'project', 'local'].flatMap(value => [0, 1, 2].map(depth => ({ value, depth }))))(
    'rejects %s symlink directory descendants', ({ value, depth }) => {
      scope(value);
      const base = value === 'user' ? home : project;
      // For user scope the metadata lives under .claude. Use project metadata
      // when .claude itself is the malicious link so scope selection stays valid.
      if (value === 'user' && depth === 0) {
        file(join(project, '.claude', 'agents', 'scout.md'), '---\nmemory: user\n---\n');
        rmSync(join(home, '.claude'), { recursive: true });
      }
      const parts = ['.claude', value === 'local' ? 'agent-memory-local' : 'agent-memory', 'scout'];
      const linkedPath = join(base, ...parts.slice(0, depth + 1));
      const outside = join(fixture, 'outside');
      const redirectedDir = join(outside, ...parts.slice(depth + 1));
      file(join(redirectedDir, 'learnings.md'), secret);
      mkdirSync(resolve(linkedPath, '..'), { recursive: true });
      symlinkSync(outside, linkedPath);
      expect(run('loader')).not.toContain(secret);
      run('saver');
      expect(readFileSync(join(redirectedDir, 'learnings.md'), 'utf-8')).toBe(secret);
      expect(existsSync(join(redirectedDir, 'MEMORY.md'))).toBe(false);
    },
  );

  it.each(['file', 'agents', '.claude'])('ignores symlinked project metadata at %s and honors safe user metadata', kind => {
    scope('user');
    const outside = join(fixture, 'outside-metadata');
    const parts = ['.claude', 'agents', 'scout.md'];
    const depth = kind === 'file' ? 2 : kind === 'agents' ? 1 : 0;
    const linkedPath = join(project, ...parts.slice(0, depth + 1));
    const target = kind === 'file' ? join(outside, 'scout.md') : outside;
    file(kind === 'file' ? target : join(target, ...parts.slice(depth + 1)), '---\nmemory: project\n---\n');
    mkdirSync(resolve(linkedPath, '..'), { recursive: true });
    symlinkSync(target, linkedPath);
    run('saver');
    expect(readFileSync(join(memoryDir('user'), 'learnings.md'), 'utf-8')).toContain('Root cause');
    expect(run('loader')).toContain('scope: user');
    expect(existsSync(join(outside, 'agent-memory'))).toBe(false);
  });

  it('accepts symlinked environment anchors such as macOS /tmp aliases', () => {
    scope('project');
    const projectAlias = join(fixture, 'project-alias');
    const homeAlias = join(fixture, 'home-alias');
    symlinkSync(project, projectAlias);
    symlinkSync(home, homeAlias);
    project = projectAlias;
    run('saver', { HOME: homeAlias });
    expect(readFileSync(join(realpathSync(project), '.claude', 'agent-memory', 'scout', 'learnings.md'), 'utf-8')).toContain('Root cause');
    expect(run('loader', { HOME: homeAlias })).toContain('Root cause');
  });

  it('retains distinct concurrent Agent learnings while compacting a near-cap journal', async () => {
    scope('project');
    const journal = join(memoryDir('project'), 'learnings.md');
    file(journal, 'old padding\n' + 'p'.repeat(49_700));
    const markers = Array.from({ length: 8 }, (_, index) => `CONCURRENT_LEARNING_${index}`);
    await Promise.all(markers.map(marker => new Promise<void>((done, fail) => {
      const child = spawn(process.execPath, [join(bundles, 'agent-memory-saver.mjs')], {
        cwd: project, env: { HOME: home, PATH: '' }, stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('error', fail);
      child.on('close', status => {
        try {
          expect(status, stderr).toBe(0);
          expect(stderr).toBe('');
          done();
        } catch (error) { fail(error); }
      });
      child.stdin.end(JSON.stringify({
        cwd: project, tool_name: 'Agent', tool_input: { subagent_type: 'scout', description: marker },
        tool_response: { content: [{ type: 'text', text: `Root cause: ${marker}. Fixed issue by serializing cache writes across all concurrent tasks.` }] },
      }));
    })));
    const content = readFileSync(journal, 'utf-8');
    for (const marker of markers) expect(content).toContain(`Root cause: ${marker}.`);
    expect(content.length).toBeLessThan(50_000);
    expect(existsSync(join(memoryDir('project'), '.learnings.lock'))).toBe(false);
  });

  it('fails closed on a symlinked lock and leaves its target unchanged', () => {
    scope('project');
    const dir = memoryDir('project');
    mkdirSync(dir, { recursive: true });
    const external = join(fixture, 'outside-lock');
    file(external, 'DO_NOT_CHANGE');
    symlinkSync(external, join(dir, '.learnings.lock'));
    run('saver');
    expect(readFileSync(external, 'utf-8')).toBe('DO_NOT_CHANGE');
    expect(existsSync(join(dir, 'learnings.md'))).toBe(false);
  });

  it.each(['{"pid":2147483647}', 'malformed lock'])('bounds waiting on an abandoned or malformed lock without changing memory: %s', lock => {
    scope('project');
    const dir = memoryDir('project');
    file(join(dir, 'learnings.md'), 'EXISTING_LEARNINGS');
    file(join(dir, '.learnings.lock'), lock);
    const result = spawnSync(process.execPath, [join(bundles, 'agent-memory-saver.mjs')], {
      input: JSON.stringify({
        cwd: project, tool_name: 'Agent', tool_input: { subagent_type: 'scout' },
        tool_response: { content: [{ type: 'text', text: response }] },
      }),
      cwd: project, env: { HOME: home, PATH: '' }, encoding: 'utf-8', timeout: 4000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Optional save skipped');
    expect(result.stderr).toContain('after all writers stop');
    expect(readFileSync(join(dir, '.learnings.lock'), 'utf-8')).toBe(lock);
    expect(readFileSync(join(dir, 'learnings.md'), 'utf-8')).toBe('EXISTING_LEARNINGS');
    expect(existsSync(join(dir, 'MEMORY.md'))).toBe(false);
  });
});
