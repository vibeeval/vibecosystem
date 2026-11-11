import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MANIFEST_NAME = 'runtime-manifest.json';

export function loadRuntimeManifest(repoDir) {
  const file = join(repoDir, 'profiles', MANIFEST_NAME);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function mergeValues(base, extra) {
  if (base === 'all' || extra === 'all') return 'all';
  return [...new Set([...(base || []), ...(extra || [])])];
}

function expandProfile(manifest, profile, seen = new Set()) {
  const canonical = manifest.aliases?.[profile] || profile;
  if (seen.has(canonical)) throw new Error(`Circular profile inheritance: ${canonical}`);
  seen.add(canonical);

  const definition = manifest.profiles?.[canonical];
  if (!definition) return null;

  const parent = definition.extends
    ? expandProfile(manifest, definition.extends, seen)
    : { profile: canonical, agents: [], skills: [], rules: [], hooks: [], contextBudget: {} };

  return {
    profile: canonical,
    description: definition.description || parent.description,
    agents: mergeValues(parent.agents, definition.agents),
    skills: mergeValues(parent.skills, definition.skills),
    rules: mergeValues(parent.rules, definition.rules),
    hooks: mergeValues(parent.hooks, definition.hooks),
    contextBudget: {
      ...(parent.contextBudget || {}),
      ...(definition.contextBudget || {})
    }
  };
}

export function resolveProfile(repoDir, profile = 'core') {
  const manifest = loadRuntimeManifest(repoDir);
  const expanded = expandProfile(manifest, profile);
  if (expanded) return { ...expanded, requestedProfile: profile };

  const legacyPath = join(repoDir, 'profiles', `${profile}.json`);
  if (!existsSync(legacyPath)) throw new Error(`Unknown profile: ${profile}`);
  const legacy = JSON.parse(readFileSync(legacyPath, 'utf8'));
  const core = expandProfile(manifest, 'core');
  return {
    ...core,
    requestedProfile: profile,
    profile,
    description: legacy.description || profile,
    agents: legacy.agents || core.agents,
    skills: legacy.skills || core.skills,
    rules: legacy.rules === 'all' ? 'all' : core.rules,
    hooks: core.hooks
  };
}

export function hookNameFromCommand(command) {
  const match = String(command || '').match(/hooks\/dist\/([^/]+)\.mjs(?:\s|$)/);
  return match ? match[1] : null;
}

export function registeredHookFiles(manifest) {
  const files = new Set();
  for (const groups of Object.values(manifest?.hooks || {})) {
    for (const group of groups || []) {
      for (const hook of group.hooks || []) {
        const name = hookNameFromCommand(hook?.command);
        if (name) files.add(name);
      }
    }
  }
  return [...files].sort();
}

export function filterHookManifest(manifest, enabledHooks) {
  if (enabledHooks === 'all') return manifest;
  const allowed = new Set(enabledHooks || []);
  const filtered = { ...manifest, hooks: {} };

  for (const [event, groups] of Object.entries(manifest.hooks || {})) {
    const nextGroups = [];
    for (const group of groups || []) {
      const hooks = (group.hooks || []).filter((hook) => {
        const name = hookNameFromCommand(hook.command);
        return name && allowed.has(name);
      });
      if (hooks.length > 0) nextGroups.push({ ...group, hooks });
    }
    if (nextGroups.length > 0) filtered.hooks[event] = nextGroups;
  }
  return filtered;
}

export function countRegisteredHookCommands(manifest) {
  return Object.values(manifest.hooks || {})
    .flat()
    .reduce((count, group) => count + (group.hooks || []).length, 0);
}

export function repoDirFromHookManifest(manifestPath) {
  return dirname(dirname(manifestPath));
}
