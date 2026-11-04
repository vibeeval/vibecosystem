import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildSync } from 'esbuild';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, chmodSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { hookResponseText, readHookInput } from '../shared/hook-input.js';
import { sanitizeAgentType } from '../shared/agent-memory.js';

describe('Claude hook input protocol', () => {
  it('parses a stdin JSON object and rejects other JSON values', () => {
    expect(readHookInput('{"session_id":"test","tool_name":"Read"}')).toMatchObject({ tool_name: 'Read' });
    for (const raw of ['', 'null', '[]', '"text"', 'false']) {
      expect(() => readHookInput(raw)).toThrow();
    }
  });

  it('extracts Bash, Read, Agent and legacy responses without object coercion', () => {
    expect(hookResponseText({ tool_response: { stdout: 'out', stderr: 'err' } })).toBe('out\nerr');
    expect(hookResponseText({ tool_response: { type: 'text', file: { content: '# text' } } })).toBe('# text');
    expect(hookResponseText({ tool_response: { content: [{ type: 'text', text: 'agent result' }] } })).toBe('agent result');
    expect(hookResponseText({ tool_response: { content: [{ type: 'image', source: { data: 'private-bitmap' } }] } })).toBe('');
    expect(hookResponseText({ tool_output: 'legacy' })).toBe('legacy');
    expect(hookResponseText({ tool_response: '', tool_output: 'stale legacy' })).toBe('');
  });

  it('keeps agent memory path components out of parent directories', () => {
    for (const name of ['..', '../architect', '../../', '/tmp/agent', 'agent\\name']) {
      expect(sanitizeAgentType(name)).not.toMatch(/^\.|[/\\]/);
    }
  });
});

describe('bundled ESM hook behavior with isolated HOME and cwd', () => {
  const hookNames = [
    'agent-memory-loader', 'agent-memory-saver', 'magic-doc-tracker', 'dream-consolidator',
    'smart-memory-recall', 'mcp-discovery', 'plugin-registry', 'token-tracker',
    'import-error-detector', 'session-end-cleanup', 'subagent-stop-learner',
    'memory-graph', 'handoff-index', 'pre-tool-use-broadcast',
    'session-register',
  ];
  let bundleDir: string;
  let fixture: string;
  let home: string;
  let project: string;

  beforeAll(() => {
    bundleDir = mkdtempSync(join(tmpdir(), 'hook-protocol-bundles-'));
    buildSync({
      entryPoints: hookNames.map(name => resolve('src', `${name}.ts`)),
      bundle: true, platform: 'node', format: 'esm', outdir: bundleDir,
      outExtension: { '.js': '.mjs' }, external: ['better-sqlite3'], logLevel: 'silent',
    });
    buildSync({
      stdin: {
        contents: "import { createIssue, addPRComment } from './src/shared/github-bridge.ts'; console.log(JSON.stringify([createIssue('fixture', 'fixture'), addPRComment(1, 'fixture')]));",
        resolveDir: process.cwd(), loader: 'ts',
      },
      bundle: true, platform: 'node', format: 'esm',
      outfile: join(bundleDir, 'github-mutations-fixture.mjs'), logLevel: 'silent',
    });
  });
  afterAll(() => rmSync(bundleDir, { recursive: true, force: true }));
  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'hook-protocol-fixture-'));
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

  function run(name: string, input: Record<string, unknown>, args: string[] = [], env: Record<string, string> = {}) {
    const result = spawnSync(process.execPath, [join(bundleDir, `${name}.mjs`), ...args], {
      input: JSON.stringify({ session_id: 'isolated-test', cwd: project, ...input }),
      cwd: project,
      // No inherited credentials, authenticated CLIs or live project paths.
      env: { HOME: home, PATH: '', CLAUDE_PROJECT_DIR: project, ...env },
      encoding: 'utf-8', timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toMatch(/require is not defined|Dynamic require|ReferenceError/);
    return result.stdout.trim();
  }

  it.each(['user', 'project', 'local'])('saves and reloads canonical Agent responses in %s memory scope', scope => {
    file(join(home, '.claude', 'agents', 'architect.md'), `---\r\nname: architect\r\nmemory: ${scope}\r\n---\r\n`);
    const response = 'Root cause: concurrent cache writes caused stale architecture state. Fixed issue by serializing updates.';
    run('agent-memory-saver', {
      tool_name: 'Agent', tool_input: { subagent_type: 'architect', description: 'Cache repair' },
      tool_response: { content: [{ type: 'text', text: response }] },
    });
    const root = scope === 'user' ? join(home, '.claude') : join(project, '.claude');
    const memoryDir = join(root, scope === 'local' ? 'agent-memory-local' : 'agent-memory', 'architect');
    expect(readFileSync(join(memoryDir, 'learnings.md'), 'utf-8')).toContain('Root cause');
    if (scope !== 'user') expect(existsSync(join(home, '.claude', 'agent-memory', 'architect'))).toBe(false);
    const loaded = JSON.parse(run('agent-memory-loader', { tool_name: 'Agent', tool_input: { subagent_type: 'architect' } }));
    expect(loaded.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(loaded.hookSpecificOutput.additionalContext).toContain('Root cause');
    expect(loaded.hookSpecificOutput.additionalContext).toContain(memoryDir);
  });

  it('tracks Read file.content from stdin and emits valid PostToolUse context', () => {
    const path = join(project, 'guide.md');
    const result = JSON.parse(run('magic-doc-tracker', {
      tool_name: 'Read', tool_input: { file_path: path },
      tool_response: { type: 'text', file: { content: '# MAGIC DOC: Project guide\n*Keep examples current*' } },
    }));
    expect(result.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    const tracked = JSON.parse(readFileSync(join(home, '.claude', 'magic-docs', 'tracked.json'), 'utf-8'));
    expect(tracked[path].title).toBe('Project guide');
  });

  it('persists successful Agent summaries instead of creating an empty memory index', () => {
    run('agent-memory-saver', {
      tool_name: 'Agent', tool_input: { subagent_type: 'spark' },
      tool_response: { content: [{ type: 'text', text: 'Implemented the requested cache changes and all tests passed across the isolated build.' }] },
    });
    expect(readFileSync(join(home, '.claude', 'agent-memory', 'spark', 'learnings.md'), 'utf-8')).toContain('Implemented');
  });

  it('uses SessionStart source to avoid consolidation on resume', () => {
    for (let n = 0; n < 3; n++) file(join(home, '.claude', 'projects', `fixture-${n}`, 'memory', 'MEMORY.md'), '# Memory');
    expect(run('dream-consolidator', { source: 'resume' })).toBe('');
    expect(existsSync(join(home, '.claude', 'dream', 'lock.json'))).toBe(false);
    const result = JSON.parse(run('dream-consolidator', { source: 'startup' }));
    expect(result.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(result.hookSpecificOutput.additionalContext).toContain('Memory Consolidation');
  });

  it('recalls matching current-project memory without leaking other projects or unrelated recent memories', () => {
    const key = project.replace(/[^a-zA-Z0-9]/g, '-');
    file(join(home, '.claude', 'projects', key, 'memory', 'caching.md'), '---\nname: cache architecture\ndescription: cache invalidation\n---\nACTIVE_PROJECT_MEMORY');
    file(join(home, '.claude', 'projects', 'other-project', 'memory', 'caching.md'), '---\nname: cache architecture\n---\nOTHER_PROJECT_PRIVATE_MEMORY');
    file(join(home, '.claude', 'agent-memory', 'architect', 'unrelated.md'), '---\nname: colors\ntype: feedback\n---\nUNRELATED_RECENT_MEMORY');
    const result = run('smart-memory-recall', { prompt: 'Explain cache architecture patterns' });
    expect(result).toContain('ACTIVE_PROJECT_MEMORY');
    expect(result).not.toContain('OTHER_PROJECT_PRIVATE_MEMORY');
    expect(result).not.toContain('UNRELATED_RECENT_MEMORY');
    expect(run('smart-memory-recall', { prompt: 'Explain zeppelins and aerodynamics' })).toBe('');
  });

  it('discovers SQL files in bundled ESM and suppresses repeated session advice', () => {
    file(join(project, 'schema.sql'), 'select 1;');
    expect(run('mcp-discovery', { tool_name: 'Read', tool_input: {} })).toContain('postgres');
    expect(run('mcp-discovery', { session_id: 'second-session', tool_name: 'Read', tool_input: {} })).toContain('postgres');
    expect(run('mcp-discovery', { tool_name: 'Read', tool_input: {} })).toBe('{}');
  });

  it('lists installed skill directories and writes registry config on a fresh HOME', () => {
    file(join(home, '.claude', 'skills', 'example', 'SKILL.md'), '# Example');
    expect(run('plugin-registry', {}, ['status'])).toContain('1');
    run('plugin-registry', {}, ['disable', 'sample']);
    const config = JSON.parse(readFileSync(join(home, '.claude', 'plugin-config.json'), 'utf-8'));
    expect(config.hooks.sample.enabled).toBe(false);
  });

  it('counts canonical response text and rejects null or negative provider usage', () => {
    run('token-tracker', {
      tool_name: 'Bash', tool_input: {}, tool_response: { stdout: 'hello world', stderr: 'warning' },
      usage: { input_tokens: null, output_tokens: -1, total_tokens: -10 },
    });
    const entry = JSON.parse(readFileSync(join(home, '.claude', 'token-usage.jsonl'), 'utf-8').trim());
    expect(entry.output_chars).toBe('hello world\nwarning'.length);
    expect(entry.output_tokens_est).toBeGreaterThan(0);
    expect(entry.token_source).toBe('estimate');
  });

  it('detects structured Bash import errors and structured Agent learnings', () => {
    const result = JSON.parse(run('import-error-detector', {
      tool_name: 'Bash', tool_input: {}, tool_response: { stderr: "ModuleNotFoundError: No module named 'requests'" },
    }));
    expect(result.hookSpecificOutput.additionalContext).toContain('requests');
    run('subagent-stop-learner', {
      tool_name: 'Agent', tool_input: { subagent_type: 'architect' },
      tool_response: { content: [{ type: 'text', text: 'Root cause: the cache was updated without a transaction boundary.' }] },
    });
    expect(readFileSync(join(home, '.claude', 'agent-learnings.jsonl'), 'utf-8')).toContain('architect:root-cause');
  });

  it('does not spawn external Braintrust learning merely because a key exists', () => {
    mkdirSync(join(project, 'thoughts', 'ledgers'), { recursive: true });
    file(join(project, 'scripts', 'braintrust_analyze.py'), '# fixture only');
    const bin = join(fixture, 'bin');
    const marker = join(fixture, 'spawned');
    file(join(bin, 'uv'), `#!/bin/sh\n/bin/touch '${marker}'\n`);
    // An executable fake CLI would leave a marker if the guard were absent.
    chmodSync(join(bin, 'uv'), 0o755);
    run('session-end-cleanup', { reason: 'other' }, [], { PATH: bin, BRAINTRUST_API_KEY: 'fixture-key' });
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(join(home, '.claude', 'braintrust-extractor.lock'))).toBe(false);
  });

  it('maintains stale agent output caches even when no continuity ledger exists', () => {
    const oldOutput = join(project, '.claude', 'cache', 'agents', 'fixture', 'latest-output.md');
    file(oldOutput, 'temporary agent output');
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    utimesSync(oldOutput, old, old);
    run('session-end-cleanup', { reason: 'other' });
    expect(existsSync(oldOutput)).toBe(false);
  });

  it('requires explicit opt-in before publishing GitHub issues or comments', () => {
    const bin = join(fixture, 'bin');
    const marker = join(fixture, 'github-called');
    file(join(bin, 'gh'), `#!/bin/sh\n/bin/touch '${marker}'\n`);
    chmodSync(join(bin, 'gh'), 0o755);
    expect(run('github-mutations-fixture', {}, [], { PATH: bin })).toBe('[null,false]');
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(join(home, '.claude', 'cache', 'github-rate-limit.json'))).toBe(false);
  });

  it('starts unrelated optional SQLite hooks without the native package and diagnoses a needed SQLite operation', () => {
    expect(run('handoff-index', { tool_name: 'Read', tool_input: {} })).toContain('continue');
    expect(run('pre-tool-use-broadcast', { tool_name: 'Read', tool_input: {} })).toContain('continue');
    const result = spawnSync(process.execPath, [join(bundleDir, 'memory-graph.mjs')], {
      input: JSON.stringify({ session_id: 'isolated-sqlite', hook_event_name: 'Stop' }),
      cwd: project, env: { HOME: home, PATH: '' }, encoding: 'utf-8', timeout: 5000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('{}');
    expect(result.stderr).toContain('SQLite operation skipped');
    expect(result.stderr).toContain('better-sqlite3');
    expect(result.stderr).not.toMatch(/ERR_MODULE_NOT_FOUND|ReferenceError/);
    expect(existsSync(join(home, '.claude', 'cache', 'memory-graph.db'))).toBe(false);
  });

  it('uses the real session ID and reports coordination only after confirmed registration', () => {
    const bin = join(fixture, 'bin');
    const opc = join(fixture, 'opc');
    mkdirSync(opc);
    file(join(bin, 'uv'), '#!/bin/sh\ncase "$4" in *"INSERT INTO sessions"*) echo ok ;; *) echo "[]" ;; esac\n');
    chmodSync(join(bin, 'uv'), 0o755);
    const env = { PATH: bin, CLAUDE_OPC_DIR: opc };
    const output = JSON.parse(run('session-register', { session_id: 'claude-real-session', source: 'startup' }, [], env));
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('claude-real-session');
    expect(readFileSync(join(home, '.claude', '.coordination-session-id'), 'utf-8')).toBe('claude-real-session');
    file(join(bin, 'uv'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(bin, 'uv'), 0o755);
    expect(run('session-register', { source: 'resume' }, [], env)).toBe('{}');
  });
});
