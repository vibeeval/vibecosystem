import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSync } from 'esbuild';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('installed path rule context', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'vibeco-path-rule-'));
  const home = join(fixture, 'home');
  const project = join(fixture, 'project');
  const bundle = join(fixture, 'path-rules.mjs');
  beforeAll(() => {
    mkdirSync(project);
    mkdirSync(join(home, '.claude', 'skills', 'wiring'), { recursive: true });
    writeFileSync(join(home, '.claude', 'skills', 'wiring', 'SKILL.md'),
      '---\nname: wiring\ndescription: fixture\n---\n' + 'global advice '.repeat(1000));
    writeFileSync(join(home, '.claude', 'vibecosystem-runtime.json'), JSON.stringify({
      contextBudget: { perEventChars: 200, sessionChars: 400 },
    }));
    buildSync({ entryPoints: [resolve('src/path-rules.ts')], bundle: true,
      platform: 'node', format: 'esm', outfile: bundle, logLevel: 'silent' });
  });
  afterAll(() => rmSync(fixture, { recursive: true, force: true }));
  function run(session: string, invocation: string) {
    const result = spawnSync(process.execPath, [bundle], {
      cwd: project, env: { HOME: home, PATH: '', CLAUDE_PROJECT_DIR: project },
      input: JSON.stringify({ cwd: project, session_id: session, tool_use_id: invocation,
        tool_name: 'Read', tool_input: { file_path: join(project, '.claude', 'settings.json') } }),
      encoding: 'utf8', timeout: 5000,
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
  }
  it('loads a globally installed skill, bounds model context and deduplicates the same advice', () => {
    const output = run('global', 'one');
    expect(output.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(output.hookSpecificOutput.additionalContext).toContain('global advice');
    expect(output.hookSpecificOutput.additionalContext.length).toBeLessThanOrEqual(200);
    expect(output.hookSpecificOutput.additionalContext).not.toContain('description:');
    expect(run('global', 'two')).toEqual({});
    expect(run('new-session', 'one').hookSpecificOutput.additionalContext).toBeTruthy();
  });
  it('honors project-specific skill content before global content', () => {
    const directory = join(project, '.claude', 'skills', 'wiring');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'SKILL.md'), '---\r\nname: wiring\r\n---\r\nproject-specific advice');
    expect(run('project', 'one').hookSpecificOutput.additionalContext).toBe('project-specific advice');
  });
});
