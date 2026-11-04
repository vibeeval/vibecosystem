#!/usr/bin/env node
/** Merge selected hooks while preserving hooks not owned by this installer. */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countRegisteredHookCommands, filterHookManifest, repoDirFromHookManifest, resolveProfile } from './profile-runtime.mjs';

const keyFor = (event, matcher, command) => `${event}\u0000${matcher ?? ''}\u0000${command}`;
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export function mergeOwnedHooks({ manifest, settings = {}, claudeDir, ownedHookKeys = [] }) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('settings.json must contain an object');
  const previouslyOwned = new Set(ownedHookKeys);
  const hooks = {};
  const nextOwned = new Set();
  let added = 0;
  let skipped = 0;
  for (const [event, groups] of Object.entries(settings.hooks || {})) {
    if (!Array.isArray(groups)) throw new Error(`settings.hooks.${event} must be an array`);
    const remaining = groups.map((group) => ({
      ...group,
      hooks: (group.hooks || []).filter((hook) => !previouslyOwned.has(keyFor(event, group.matcher, hook.command))),
    })).filter((group) => group.hooks.length);
    if (remaining.length) hooks[event] = remaining;
  }
  for (const [event, groups] of Object.entries(manifest.hooks || {})) {
    const existing = hooks[event] || [];
    const commands = new Set(existing.flatMap((group) => (group.hooks || []).map((hook) => keyFor(event, group.matcher, hook.command))));
    for (const group of groups || []) {
      const selected = [];
      for (const hook of group.hooks || []) {
        const resolved = { ...hook, command: hook.command.replaceAll('${CLAUDE_PLUGIN_ROOT}', shellQuote(claudeDir)) };
        const key = keyFor(event, group.matcher, resolved.command);
        // An identical pre-existing user hook remains user-owned.
        if (commands.has(key)) { skipped += 1; continue; }
        commands.add(key);
        nextOwned.add(key);
        selected.push(resolved);
        added += 1;
      }
      if (selected.length) existing.push({ ...group, hooks: selected });
    }
    if (existing.length) hooks[event] = existing;
  }
  return { settings: { ...settings, hooks }, ownedHookKeys: [...nextOwned], registeredHookCommands: countRegisteredHookCommands(manifest), added, skipped };
}

function main() {
  const [manifestPath, settingsPath, claudeDir, requestedProfile = 'core'] = process.argv.slice(2);
  if (!manifestPath || !settingsPath || !claudeDir) throw new Error('Usage: register-hooks.mjs <hooks.json> <settings.json> <claude-dir> [profile]');
  const runtime = resolveProfile(repoDirFromHookManifest(manifestPath), requestedProfile);
  const manifest = filterHookManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), runtime.hooks);
  const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
  const statePath = join(claudeDir, 'vibecosystem-runtime.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  const merged = mergeOwnedHooks({ manifest, settings, claudeDir, ownedHookKeys: state.ownedHookKeys });
  fs.mkdirSync(dirname(settingsPath), { recursive: true });
  if (fs.existsSync(settingsPath)) fs.copyFileSync(settingsPath, `${settingsPath}.bak-${Date.now()}`);
  fs.writeFileSync(settingsPath, `${JSON.stringify(merged.settings, null, 2)}\n`);
  fs.writeFileSync(statePath, `${JSON.stringify({ ...state, activeProfile: runtime.profile, requestedProfile, contextBudget: runtime.contextBudget, ownedHookKeys: merged.ownedHookKeys, registeredHookCommands: merged.registeredHookCommands }, null, 2)}\n`);
  console.log(`Hooks registered: ${merged.added} added, ${merged.skipped} already present`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`Hook registration failed: ${error.message}`); process.exitCode = 1; }
}
