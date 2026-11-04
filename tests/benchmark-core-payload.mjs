#!/usr/bin/env node
// Compares actual entrypoint payload bytes, not model tokenization or billing.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.argv[2] || '3b763b1fb288f57bfa3cce76ef18184b96461a78';
const beforeManifest = JSON.parse(execFileSync('git', ['show', `${baseline}:profiles/runtime-manifest.json`], { cwd: root }));
const afterManifest = JSON.parse(readFileSync(resolve(root, 'profiles/runtime-manifest.json')));
function measure(manifest, before) {
  const entries = manifest.profiles.core.skills.map(name => {
    const path = `skills/${name}/SKILL.md`;
    const content = before ? execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root })
      : readFileSync(resolve(root, path));
    return { name, utf8_bytes: content.length, utf16_code_units: content.toString('utf8').length };
  });
  return { selected_skills: entries.length, entrypoint_utf8_bytes: entries.reduce((n, entry) => n + entry.utf8_bytes, 0), entries };
}
const before = measure(beforeManifest, true);
const after = measure(afterManifest, false);
console.log(JSON.stringify({ baseline, metric: 'Sum of selected core SKILL.md entrypoint UTF-8 bytes',
  caveat: 'Skills load on demand; this is available instruction payload, not per-session tokens, tokenizer output or billing.',
  before, after, reduction_percent: Number(((1 - after.entrypoint_utf8_bytes / before.entrypoint_utf8_bytes) * 100).toFixed(2)),
}, null, 2));
