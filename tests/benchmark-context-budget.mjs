#!/usr/bin/env node
/** Reproducible advisory payload comparison; does not call an LLM or estimate billing tokens. */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { buildSync } from '../hooks/node_modules/esbuild/lib/main.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.argv[2] || '3b763b1fb288f57bfa3cce76ef18184b96461a78';
const directory = mkdtempSync(join(tmpdir(), 'vibeco-budget-bench-'));
const originalEnvironment = {
  VIBECO_CONTEXT_BUDGET_PATH: process.env.VIBECO_CONTEXT_BUDGET_PATH,
  VIBECO_RUNTIME_PATH: process.env.VIBECO_RUNTIME_PATH,
};
const reminder = '<epistemic-reminder>\nGrep results are evidence, not proof. Verify with Read before claiming.\n</epistemic-reminder>';
const repetitions = 20;
function configure(module, session, event) {
  module.configureContextBudget?.({ session_id: session, cwd: '/benchmark-project', tool_use_id: event });
}
function environment(name) {
  const path = join(directory, name);
  mkdirSync(path, { recursive: true });
  process.env.VIBECO_CONTEXT_BUDGET_PATH = join(path, 'budget.json');
  process.env.VIBECO_RUNTIME_PATH = join(path, 'runtime.json');
  writeFileSync(process.env.VIBECO_RUNTIME_PATH, JSON.stringify({ contextBudget: { perEventChars: 4000, sessionChars: 12000 } }));
}
try {
  const beforeSource = execFileSync('git', ['show', `${baseline}:hooks/src/shared/context-budget.ts`], { cwd: root, encoding: 'utf8' });
  const beforePath = join(directory, 'before.mjs');
  const afterPath = join(directory, 'after.mjs');
  buildSync({ stdin: { contents: beforeSource, loader: 'ts', resolveDir: root }, outfile: beforePath,
    bundle: true, platform: 'node', format: 'esm' });
  buildSync({ entryPoints: [join(root, 'hooks/src/shared/context-budget.ts')], outfile: afterPath,
    bundle: true, platform: 'node', format: 'esm' });
  const results = {};
  for (const [name, path] of [['before', beforePath], ['after', afterPath]]) {
    const module = await import(pathToFileURL(path).href);
    environment(`${name}-reminders`);
    configure(module, 'reminders', 'initial');
    module.resetBudget('reminders');
    const emitted = [];
    const start = performance.now();
    for (let index = 0; index < repetitions; index++) {
      configure(module, 'reminders', `read-${index}`);
      emitted.push(module.budgetContext('epistemic-reminder', 'PostToolUse:Grep', reminder, { deduplicate: 'session' }));
    }
    const elapsed = performance.now() - start;
    environment(`${name}-sessions`);
    configure(module, 'first', 'initial');
    module.resetBudget('first');
    for (let index = 0; index < 3; index++) {
      configure(module, 'first', `fill-${index}`);
      module.budgetContext('hook', `event-${index}`, 'x'.repeat(4000));
    }
    // A different payload session starts without relying on a registration/reset hook.
    configure(module, 'second', 'first-event');
    const secondSession = module.budgetContext('hook', 'event-new-session', 'Fresh session context');
    results[name] = {
      repeated_advisory_emissions: emitted.filter(Boolean).length,
      emitted_utf16_code_units: emitted.reduce((total, value) => total + value.length, 0),
      emitted_utf8_bytes: emitted.reduce((total, value) => total + Buffer.byteLength(value), 0),
      elapsed_ms: Number(elapsed.toFixed(3)),
      fresh_session_emitted_utf16_code_units: secondSession.length,
    };
  }
  const report = {
    baseline_commit: baseline,
    measurement: 'Synthetic 20-event repetition of an unchanged Grep advisory; UTF-16 code units and UTF-8 bytes, not model tokens.',
    repetitions,
    advisory_utf16_code_units: reminder.length,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    ...results,
    advisory_payload_reduction_percent: Number((100 * (1 - results.after.emitted_utf16_code_units / results.before.emitted_utf16_code_units)).toFixed(2)),
    limitations: [
      'This controlled fixture measures deduplication of identical optional advice, not task quality, total session tokens, or billed token savings.',
      'Timing includes filesystem coordination and is a single local sample; it is not an end-to-end latency benchmark.',
      'Session-wide deduplication is opt-in for epistemic reminders; subagent and changing context remain per invocation.',
    ],
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  rmSync(directory, { recursive: true, force: true });
}
