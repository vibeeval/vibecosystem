/** Native SQLite is an optional full-profile capability, never a startup import. */
import { createRequire } from 'node:module';
import type BetterSqlite3 from 'better-sqlite3';

export function reportSqliteUnavailable(hook: string): void {
  console.error(`[${hook}] SQLite operation skipped: optional better-sqlite3 is missing or incompatible. Install a Node-compatible version in the hooks directory (for a managed install: ~/.claude/hooks), or use the core profile.`);
}

export function loadOptionalSqlite(hook: string): typeof BetterSqlite3 | null {
  try {
    // Resolve next to the installed .mjs bundle, not the current project.
    return createRequire(import.meta.url)('better-sqlite3') as typeof BetterSqlite3;
  } catch {
    reportSqliteUnavailable(hook);
    return null;
  }
}
