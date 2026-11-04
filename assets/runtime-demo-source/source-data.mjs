import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveProfile, filterHookManifest, countRegisteredHookCommands } from '../../tools/profile-runtime.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const hookManifest = JSON.parse(readFileSync(new URL('../../hooks/hooks.json', import.meta.url), 'utf8'));
const profiles = ['core', 'quality', 'context', 'memory', 'orchestration', 'dashboard'].map(name => {
  const profile = resolveProfile(repo, name);
  return {
    name,
    agents: profile.agents.length,
    skills: profile.skills.length,
    hooks: profile.hooks.length,
    registeredCommands: countRegisteredHookCommands(filterHookManifest(hookManifest, profile.hooks)),
    contextBudget: profile.contextBudget,
  };
});
const data = {
  kind: 'manifest-derived product diagram; not a benchmark or screen recording',
  version: JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version,
  defaultProfile: 'core',
  profiles,
};
writeFileSync(new URL('./profile-data.json', import.meta.url), `${JSON.stringify(data, null, 2)}\n`);
console.log(`Generated profile-data.json for ${data.profiles.length} profiles (v${data.version}).`);
