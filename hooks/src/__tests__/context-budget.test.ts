import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { buildSync } from 'esbuild';
import {
  budgetContext, budgetHookOutput, configureContextBudget, getBudgetLimits,
  resetBudget, tryInject,
} from '../shared/context-budget.js';

describe('context budget', () => {
  let directory: string;
  function limits(perEventChars: number, sessionChars: number): void {
    writeFileSync(process.env.VIBECO_RUNTIME_PATH!, JSON.stringify({ contextBudget: { perEventChars, sessionChars } }));
  }
  function scope(session = 'session', event = 'event', cwd = '/project'): void {
    configureContextBudget({ session_id: session, tool_use_id: event, cwd });
  }
  function stateFiles(): string[] {
    return readdirSync(join(directory, 'budget.sessions')).filter(name => name.endsWith('.json'));
  }
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'vibeco-context-budget-'));
    process.env.VIBECO_CONTEXT_BUDGET_PATH = join(directory, 'budget.json');
    process.env.VIBECO_RUNTIME_PATH = join(directory, 'runtime.json');
    configureContextBudget({});
  });
  afterEach(() => {
    delete process.env.VIBECO_CONTEXT_BUDGET_PATH;
    delete process.env.VIBECO_RUNTIME_PATH;
    configureContextBudget({});
    rmSync(directory, { recursive: true, force: true });
  });
  it('enforces core event and session limits', () => {
    limits(4000, 12000);
    resetBudget('core-session');
    expect(getBudgetLimits()).toEqual({ perEventChars: 4000, sessionChars: 12000 });
    expect(budgetContext('one', 'event:one', 'x'.repeat(4000)).length).toBe(4000);
    expect(budgetContext('one', 'event:one', 'x'.repeat(100))).toBe('');
    expect(budgetContext('two', 'event:two', 'x'.repeat(4000)).length).toBe(4000);
    expect(budgetContext('three', 'event:three', 'x'.repeat(4000)).length).toBe(4000);
    expect(budgetContext('four', 'event:four', 'x')).toBe('');
  });
  it('enforces full profile limits independently from core', () => {
    limits(8000, 50000);
    resetBudget('full-session');
    expect(getBudgetLimits()).toEqual({ perEventChars: 8000, sessionChars: 50000 });
    expect(budgetContext('one', 'event:one', 'x'.repeat(8000)).length).toBe(8000);
    expect(budgetContext('one', 'event:one', 'x')).toBe('');
  });
  it('automatically isolates sessions and projects without a reset hook', () => {
    limits(4, 4);
    scope('first');
    expect(budgetContext('hook', 'Read', '1234')).toBe('1234');
    scope('second');
    expect(budgetContext('hook', 'Read', '5678')).toBe('5678');
    scope('first', 'other-event');
    expect(budgetContext('hook', 'Read', 'more')).toBe('');
    scope('first', 'event', '/other-project');
    expect(budgetContext('hook', 'Read', 'abcd')).toBe('abcd');
    expect(stateFiles()).toHaveLength(3);
  });
  it('shares a per-invocation cap across hooks and replenishes it for the next invocation', () => {
    limits(5, 20);
    scope('one', 'tool-1');
    expect(budgetContext('first-hook', 'PreToolUse:Read', '1234')).toBe('1234');
    expect(budgetContext('second-hook', 'PreToolUse:Read:message', '5678')).toBe('5');
    scope('one', 'tool-2');
    expect(budgetContext('first-hook', 'PreToolUse:Read', '1234')).toBe('1234');
  });
  it('deduplicates identical advice within an event, with optional session-wide reminder dedup', () => {
    limits(1000, 2000);
    scope('one', 'tool-1');
    expect(budgetContext('hook', 'Read', 'advice')).toBe('advice');
    expect(budgetContext('hook', 'Read', 'advice')).toBe('');
    scope('one', 'tool-2');
    expect(budgetContext('hook', 'Read', 'advice')).toBe('advice');
    expect(budgetContext('reminder', 'Read', 'stable advice', { deduplicate: 'session' })).toBe('stable advice');
    scope('one', 'tool-3');
    expect(budgetContext('reminder', 'Read', 'stable advice', { deduplicate: 'session' })).toBe('');
    expect(budgetContext('reminder', 'Read', 'changed advice', { deduplicate: 'session' })).toBe('changed advice');
    const state = readFileSync(join(directory, 'budget.sessions', stateFiles()[0]), 'utf8');
    expect(state).not.toContain('stable advice');
    expect(state).not.toContain('/project');
  });
  it.each([0, 1, 2, 3, 5, 11, 12, 13, 20])('never exceeds a tiny or Unicode truncation cap of %i', (cap) => {
    limits(cap, cap);
    scope();
    const output = budgetContext('hook', 'Read', '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀');
    expect(output.length).toBeLessThanOrEqual(cap);
    expect(Buffer.from(output).toString('utf8')).toBe(output);
  });
  it('bounds context without truncating tool inputs or permission reasons', () => {
    limits(0, 0);
    scope();
    const output = budgetHookOutput({
      additionalContext: 'root context',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse', permissionDecision: 'deny',
        permissionDecisionReason: 'Never expose the credential',
        updatedInput: { prompt: 'Complete, mandatory task instruction' },
        additionalContext: 'nested context',
      }, systemMessage: 'optional reminder',
    }, 'hook', 'PreToolUse');
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toBe('Never expose the credential');
    expect(output.hookSpecificOutput.updatedInput.prompt).toBe('Complete, mandatory task instruction');
    expect(output).not.toHaveProperty('additionalContext');
    expect(output).not.toHaveProperty('systemMessage');
    expect(output.hookSpecificOutput).not.toHaveProperty('additionalContext');
  });
  it('rejects negative, fractional and nonfinite reservations', () => {
    scope();
    for (const invalid of [-1, 0.1, NaN, Infinity]) expect(tryInject('hook', 'Read', invalid)).toBe(false);
    expect(budgetContext('hook', 'Read', 'still available')).toBe('still available');
  });
  it('ignores the legacy global budget and validates runtime config types', () => {
    writeFileSync(process.env.VIBECO_CONTEXT_BUDGET_PATH!, JSON.stringify({ total_chars: 50000 }));
    writeFileSync(process.env.VIBECO_RUNTIME_PATH!, JSON.stringify({ contextBudget: { perEventChars: null, sessionChars: '0' } }));
    scope('new-session');
    expect(getBudgetLimits()).toEqual({ perEventChars: 4000, sessionChars: 12000 });
    expect(budgetContext('hook', 'Read', 'fresh')).toBe('fresh');
  });
  it('keeps reservations atomic across parallel hook processes', async () => {
    limits(4000, 4000);
    const modulePath = join(directory, 'context-budget.mjs');
    buildSync({ entryPoints: [join(process.cwd(), 'src/shared/context-budget.ts')], outfile: modulePath,
      bundle: true, platform: 'node', format: 'esm' });
    const source = `import {configureContextBudget,budgetContext} from ${JSON.stringify(pathToFileURL(modulePath).href)};
      configureContextBudget({session_id:'parallel',cwd:'/project',tool_use_id:'same-event'});
      console.log(budgetContext('hook', 'Read', process.argv[1].repeat(1000)).length);`;
    const outputs = await Promise.all(Array.from({ length: 8 }, (_, i) => new Promise<number>((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', source, String(i)], { env: process.env });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve(Number(stdout.trim())) : reject(new Error(stderr)));
    })));
    expect(outputs.reduce((sum, value) => sum + value, 0)).toBe(4000);
    const state = JSON.parse(readFileSync(join(directory, 'budget.sessions', stateFiles()[0]), 'utf8'));
    expect(state.total_chars).toBe(4000);
  });
});
