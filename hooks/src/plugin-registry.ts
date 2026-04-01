/**
 * Plugin Registry - Shared module for hook/skill enable/disable
 *
 * Diger hook'lar bu modulu import ederek kendi durumlarini kontrol edebilir.
 * Config dosyasi: ~/.claude/plugin-config.json
 *
 * Kullanim (hook icinde):
 *   import { isHookEnabled } from './shared/plugin-registry.js';
 *   if (!isHookEnabled('my-hook')) process.exit(0);
 *
 * Claude Code kaynak kodundan (builtinPlugins.ts) ilham alinmistir.
 *
 * CLI Kullanimi:
 *   node plugin-registry.mjs list          # Tum hook'lari listele
 *   node plugin-registry.mjs enable <hook> # Hook'u aktive et
 *   node plugin-registry.mjs disable <hook># Hook'u deaktive et
 *   node plugin-registry.mjs status        # Ozet goster
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const CLAUDE_HOME = join(homedir(), '.claude');
const CONFIG_FILE = join(CLAUDE_HOME, 'plugin-config.json');

interface PluginConfig {
  hooks: Record<string, { enabled: boolean; disabledAt?: string; reason?: string }>;
  skills: Record<string, { enabled: boolean; disabledAt?: string; reason?: string }>;
}

function loadConfig(): PluginConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // corrupt
  }
  return { hooks: {}, skills: {} };
}

function saveConfig(config: PluginConfig): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Hook'un aktif olup olmadigini kontrol et
 * Config'de yoksa default olarak aktif kabul et
 */
export function isHookEnabled(hookName: string): boolean {
  const config = loadConfig();
  const entry = config.hooks[hookName];
  if (!entry) return true; // default: enabled
  return entry.enabled;
}

/**
 * Skill'in aktif olup olmadigini kontrol et
 */
export function isSkillEnabled(skillName: string): boolean {
  const config = loadConfig();
  const entry = config.skills[skillName];
  if (!entry) return true; // default: enabled
  return entry.enabled;
}

/**
 * Hook'u enable/disable et
 */
function setHookEnabled(hookName: string, enabled: boolean, reason?: string): void {
  const config = loadConfig();
  config.hooks[hookName] = {
    enabled,
    disabledAt: enabled ? undefined : new Date().toISOString(),
    reason,
  };
  saveConfig(config);
}

/**
 * Skill'i enable/disable et
 */
function setSkillEnabled(skillName: string, enabled: boolean, reason?: string): void {
  const config = loadConfig();
  config.skills[skillName] = {
    enabled,
    disabledAt: enabled ? undefined : new Date().toISOString(),
    reason,
  };
  saveConfig(config);
}

/**
 * Tum hook dosyalarini listele
 */
function listHooks(): string[] {
  const distDir = join(CLAUDE_HOME, 'hooks', 'dist');
  if (!existsSync(distDir)) return [];
  return readdirSync(distDir)
    .filter(f => f.endsWith('.mjs'))
    .map(f => f.replace('.mjs', ''))
    .sort();
}

/**
 * Tum skill'leri listele
 */
function listSkills(): string[] {
  const skillsDir = join(CLAUDE_HOME, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir)
    .filter(f => {
      try { return require('fs').statSync(join(skillsDir, f)).isDirectory(); } catch { return false; }
    })
    .sort();
}

// CLI mode
function runCli() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list': {
      const config = loadConfig();
      const hooks = listHooks();
      console.log(`\n=== Hook Registry (${hooks.length} hooks) ===\n`);
      for (const hook of hooks) {
        const entry = config.hooks[hook];
        const status = entry && !entry.enabled ? 'DISABLED' : 'enabled';
        const reason = entry?.reason ? ` (${entry.reason})` : '';
        const marker = status === 'DISABLED' ? 'x' : '+';
        console.log(`  [${marker}] ${hook}${reason}`);
      }
      break;
    }

    case 'enable': {
      const target = args[1];
      if (!target) { console.error('Usage: plugin-registry enable <hook-name>'); process.exit(1); }
      setHookEnabled(target, true);
      console.log(`Enabled: ${target}`);
      break;
    }

    case 'disable': {
      const target = args[1];
      const reason = args[2] || undefined;
      if (!target) { console.error('Usage: plugin-registry disable <hook-name> [reason]'); process.exit(1); }
      setHookEnabled(target, false, reason);
      console.log(`Disabled: ${target}${reason ? ` (${reason})` : ''}`);
      break;
    }

    case 'enable-skill': {
      const target = args[1];
      if (!target) { console.error('Usage: plugin-registry enable-skill <skill-name>'); process.exit(1); }
      setSkillEnabled(target, true);
      console.log(`Enabled skill: ${target}`);
      break;
    }

    case 'disable-skill': {
      const target = args[1];
      const reason = args[2] || undefined;
      if (!target) { console.error('Usage: plugin-registry disable-skill <skill-name> [reason]'); process.exit(1); }
      setSkillEnabled(target, false, reason);
      console.log(`Disabled skill: ${target}${reason ? ` (${reason})` : ''}`);
      break;
    }

    case 'status': {
      const config = loadConfig();
      const disabledHooks = Object.entries(config.hooks).filter(([, v]) => !v.enabled);
      const disabledSkills = Object.entries(config.skills).filter(([, v]) => !v.enabled);
      const totalHooks = listHooks().length;
      const totalSkills = listSkills().length;

      console.log(`\n=== Plugin Registry Status ===`);
      console.log(`Hooks:  ${totalHooks - disabledHooks.length}/${totalHooks} active`);
      console.log(`Skills: ${totalSkills - disabledSkills.length}/${totalSkills} active`);

      if (disabledHooks.length > 0) {
        console.log(`\nDisabled hooks:`);
        for (const [name, entry] of disabledHooks) {
          console.log(`  - ${name}${entry.reason ? ` (${entry.reason})` : ''}`);
        }
      }
      if (disabledSkills.length > 0) {
        console.log(`\nDisabled skills:`);
        for (const [name, entry] of disabledSkills) {
          console.log(`  - ${name}${entry.reason ? ` (${entry.reason})` : ''}`);
        }
      }
      break;
    }

    default:
      console.log('Usage: plugin-registry <list|enable|disable|enable-skill|disable-skill|status> [name] [reason]');
  }
}

// CLI mode: dogrudan calistirildiginda
const isCliCall = process.argv.length > 2 && ['list', 'enable', 'disable', 'enable-skill', 'disable-skill', 'status'].includes(process.argv[2]);
if (isCliCall) {
  runCli();
}
