/**
 * Plugin Check - Lightweight helper for hooks to check their enabled status
 *
 * Usage in any hook:
 *   import { isHookEnabled } from './shared/plugin-check.js';
 *   if (!isHookEnabled('my-hook-name')) process.exit(0);
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILE = join(homedir(), '.claude', 'plugin-config.json');

let cachedConfig: Record<string, any> | null = null;

function loadConfig(): Record<string, any> {
  if (cachedConfig) return cachedConfig;
  try {
    if (existsSync(CONFIG_FILE)) {
      cachedConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      return cachedConfig!;
    }
  } catch {
    // corrupt or missing
  }
  return { hooks: {}, skills: {} };
}

export function isHookEnabled(hookName: string): boolean {
  const config = loadConfig();
  const entry = config.hooks?.[hookName];
  if (!entry) return true;
  return entry.enabled !== false;
}

export function isSkillEnabled(skillName: string): boolean {
  const config = loadConfig();
  const entry = config.skills?.[skillName];
  if (!entry) return true;
  return entry.enabled !== false;
}
