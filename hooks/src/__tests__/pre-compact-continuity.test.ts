import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildSync } from 'esbuild';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseTranscript, generateAutoHandoff } from '../transcript-parser.js';

describe('bundled precompact transcript parsing and standalone CLI', () => {
  let bundles: string;
  let fixture: string;
  let home: string;
  let project: string;
  let transcript: string;

  beforeAll(() => {
    // /tmp is an alias on macOS. Use its real path so the entry-point comparison
    // behaves exactly as it does on Linux, where the imported CLI used to exit.
    bundles = realpathSync(mkdtempSync(join(tmpdir(), 'precompact-bundles-')));
    buildSync({
      entryPoints: ['pre-compact-continuity', 'transcript-parser'].map(name =>
        fileURLToPath(new URL(`../${name}.ts`, import.meta.url))),
      bundle: true, platform: 'node', format: 'esm', outdir: bundles,
      outExtension: { '.js': '.mjs' }, logLevel: 'silent',
    });
  });
  afterAll(() => rmSync(bundles, { recursive: true, force: true }));
  beforeEach(() => {
    fixture = realpathSync(mkdtempSync(join(tmpdir(), 'precompact-fixture-')));
    home = join(fixture, 'home');
    project = join(fixture, 'project');
    mkdirSync(home);
    mkdirSync(project);
    transcript = join(fixture, 'transcript.jsonl');
    writeFileSync(transcript, [
      { tool_name: 'TodoWrite', tool_input: { todos: [
        { id: 'done', content: 'Diagnose compact failure', status: 'completed' },
        { id: 'now', content: 'Verify bundled hook', status: 'in_progress' },
        { id: 'next', content: 'Ship the repair', status: 'pending' },
      ] } },
      { tool_name: 'Edit', tool_input: { file_path: 'src/repair.ts' } },
      { role: 'assistant', content: 'The transcript library must not execute CLI code.' },
    ].map(entry => JSON.stringify(entry)).join('\n'));
  });
  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  function invoke(entry: string, args: string[] = [], input?: Record<string, unknown>) {
    return spawnSync(process.execPath, [entry, ...args], {
      input: input ? JSON.stringify(input) : '', cwd: project,
      env: { HOME: home, PATH: '', CLAUDE_PROJECT_DIR: project },
      encoding: 'utf8', timeout: 5000,
    });
  }

  function compact(trigger: 'manual' | 'auto', transcriptPath = transcript) {
    const result = invoke(realpathSync(join(bundles, 'pre-compact-continuity.mjs')), [], {
      trigger, session_id: 'isolated-precompact', transcript_path: transcriptPath,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('Usage:');
    // A single JSON response also rejects accidental CLI output before the hook.
    return JSON.parse(result.stdout);
  }

  function ledger() {
    const directory = join(project, 'thoughts', 'ledgers');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'CONTINUITY_CLAUDE-fixture.md'), '# Fixture ledger\n');
  }

  function editedFiles() {
    const directory = join(project, '.claude', 'tsc-cache', 'isolated-precompact');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'edited-files.log'), `0:${project}/src/repair.ts:fixture\n`);
  }

  it('emits the no-ledger protocol instead of running an imported CLI', () => {
    expect(compact('auto')).toEqual({ continue: true, systemMessage: '[PreCompact] No ledger directory found.' });
  });

  it('keeps the manual compact reminder', () => {
    ledger();
    expect(compact('manual')).toEqual({
      continue: true,
      systemMessage: '[PreCompact] Save a brief task summary in the ledger before compacting.\nLedger: CONTINUITY_CLAUDE-fixture.md',
    });
  });

  it('parses the transcript and writes the automatic handoff', () => {
    ledger();
    editedFiles();
    const output = compact('auto');
    const directory = join(project, 'thoughts', 'shared', 'handoffs', 'fixture');
    const files = readdirSync(directory);
    expect(files).toHaveLength(1);
    expect(output).toEqual({
      continue: true,
      systemMessage: `[PreCompact:auto] Created YAML handoff: thoughts/shared/handoffs/fixture/${files[0]}`,
    });
    const handoff = readFileSync(join(directory, files[0]), 'utf8');
    expect(handoff).toContain('session: fixture\n');
    expect(handoff).toContain('now: Verify bundled hook\n');
    expect(handoff).toContain('task: "Diagnose compact failure"');
    expect(handoff).toContain('"Ship the repair"');
    expect(handoff).toContain('"src/repair.ts"');
    expect(readFileSync(join(project, 'thoughts', 'ledgers', 'CONTINUITY_CLAUDE-fixture.md'), 'utf8'))
      .toContain('Files changed: src/repair.ts');
  });

  it('appends the fallback summary to a regular ledger without a transcript', () => {
    ledger();
    editedFiles();
    expect(compact('auto', '')).toEqual({
      continue: true,
      systemMessage: '[PreCompact:auto] Session summary auto-appended to CONTINUITY_CLAUDE-fixture.md',
    });
    expect(readFileSync(join(project, 'thoughts', 'ledgers', 'CONTINUITY_CLAUDE-fixture.md'), 'utf8'))
      .toContain('Files changed: src/repair.ts');
  });

  it('leaves a symlinked ledger target unchanged', () => {
    const outside = join(fixture, 'outside-notes.md');
    const original = 'Synthetic private notes\n';
    writeFileSync(outside, original);
    const directory = join(project, 'thoughts', 'ledgers');
    mkdirSync(directory, { recursive: true });
    symlinkSync(outside, join(directory, 'CONTINUITY_CLAUDE-fixture.md'));
    editedFiles();
    expect(compact('auto', '').systemMessage).toContain('No ledger found.');
    expect(readFileSync(outside, 'utf8')).toBe(original);
  });

  it.each([{ parts: ['thoughts'] }, { parts: ['thoughts', 'ledgers'] }])('rejects a symlinked ledger ancestor $parts', ({ parts }) => {
    const outside = join(fixture, 'outside');
    mkdirSync(outside);
    const parent = join(project, ...parts.slice(0, -1));
    mkdirSync(parent, { recursive: true });
    symlinkSync(outside, join(parent, parts[parts.length - 1]));
    const directory = parts.length === 1 ? join(outside, 'ledgers') : outside;
    mkdirSync(directory, { recursive: true });
    const victim = join(directory, 'CONTINUITY_CLAUDE-fixture.md');
    writeFileSync(victim, 'Synthetic outside ledger\n');
    editedFiles();
    expect(compact('auto', '').systemMessage).toContain('No ledger directory found.');
    expect(readFileSync(victim, 'utf8')).toBe('Synthetic outside ledger\n');
  });

  it.each([
    { parts: ['shared'] }, { parts: ['shared', 'handoffs'] }, { parts: ['shared', 'handoffs', 'fixture'] },
  ])('rejects a symlinked handoff ancestor $parts', ({ parts }) => {
    ledger();
    const outside = join(fixture, 'outside');
    mkdirSync(outside);
    const parent = join(project, 'thoughts', ...parts.slice(0, -1));
    mkdirSync(parent, { recursive: true });
    symlinkSync(outside, join(parent, parts[parts.length - 1]));
    const output = compact('auto');
    expect(output.continue).toBe(true);
    expect(output.systemMessage).not.toContain('Created YAML handoff:');
    expect(output.systemMessage).toBe('[PreCompact:auto] No continuity update saved. Save a brief task summary before compacting.');
    expect(readdirSync(outside)).toEqual([]);
  });

  it('leaves predicted handoff leaf symlinks and their targets unchanged', () => {
    ledger();
    const directory = join(project, 'thoughts', 'shared', 'handoffs', 'fixture');
    mkdirSync(directory, { recursive: true });
    const victim = join(fixture, 'outside-handoff.yaml');
    writeFileSync(victim, 'Synthetic outside handoff\n');
    // Cover timestamp rollover without modifying the hook clock or bundle.
    const now = Date.now();
    for (let seconds = -1; seconds <= 10; seconds++) {
      const stamp = new Date(now + seconds * 1000).toISOString().replace(/[:.]/g, '-').slice(0, 19);
      symlinkSync(victim, join(directory, `auto-handoff-${stamp}.yaml`));
    }
    expect(compact('auto').systemMessage).not.toContain('Created YAML handoff:');
    expect(readFileSync(victim, 'utf8')).toBe('Synthetic outside handoff\n');
    expect(readdirSync(directory)).toHaveLength(12);
  });

  it('preserves the compatibility parsing and handoff exports', () => {
    const summary = parseTranscript(transcript);
    expect(summary.lastAssistantMessage).toBe('The transcript library must not execute CLI code.');
    expect(summary.filesModified).toEqual(['src/repair.ts']);
    expect(generateAutoHandoff(summary, 'api-fixture')).toContain('session: api-fixture\n');
  });

  it.each(['canonical', 'symlink', 'URL-encoded'] as const)('runs the standalone CLI through a %s path', kind => {
    let entry = realpathSync(join(bundles, 'transcript-parser.mjs'));
    if (kind === 'symlink') {
      const alias = join(fixture, 'parser alias #.mjs');
      symlinkSync(entry, alias);
      entry = alias;
    } else if (kind === 'URL-encoded') {
      const special = join(fixture, 'parser with # in name.mjs');
      copyFileSync(entry, special);
      entry = realpathSync(special);
    }
    const result = invoke(entry, [transcript, 'cli-fixture']);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    const [summary, handoff] = result.stdout.split('\n--- Summary ---\n')[1].split('\n--- Auto-Handoff ---\n');
    expect(JSON.parse(summary).filesModified).toEqual(['src/repair.ts']);
    expect(handoff).toContain('session: cli-fixture\n');
    expect(handoff).toContain('now: Verify bundled hook\n');
  });

  it('keeps the standalone CLI usage error for a missing transcript argument', () => {
    const result = invoke(realpathSync(join(bundles, 'transcript-parser.mjs')));
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Usage: npx tsx transcript-parser.ts');
    expect(result.stderr).toBe('');
  });
});
