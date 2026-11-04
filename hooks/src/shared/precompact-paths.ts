import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

export interface ContinuityDirectory {
  readonly path: string;
  readonly anchor: string;
  readonly parts: readonly string[];
}

/** Resolve the project anchor, then reject symlinks in all output descendants. */
export function continuityDirectory(project: string, parts: readonly string[], create = false): ContinuityDirectory | undefined {
  try {
    const anchor = realpathSync(project);
    if (!lstatSync(anchor).isDirectory()) return;
    let path = anchor;
    for (const part of parts) {
      if (!part || part === '.' || part === '..' || /[/\\]/.test(part)) return;
      path = join(path, part);
      if (create) {
        try { mkdirSync(path, { mode: 0o700 }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      }
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return;
    }
    if (realpathSync(path) !== path) return;
    return { path, anchor, parts };
  } catch { return; }
}

export function isContinuityDirectory(dir: ContinuityDirectory): boolean {
  return continuityDirectory(dir.anchor, dir.parts)?.path === dir.path;
}

/**
 * Open regular files without following leaf symlinks, then recheck ancestry and
 * file identity. As with other portable Node path guards, hostile concurrent
 * directory replacement cannot be eliminated without an openat-style API.
 * Callers must not use O_TRUNC: mutation happens only after descriptor checks.
 */
export function withContinuityFile<T>(dir: ContinuityDirectory, name: string, flags: number, use: (fd: number) => T): T | undefined {
  let fd: number | undefined;
  try {
    if (!name || name === '.' || name === '..' || /[/\\]/.test(name) || !isContinuityDirectory(dir)) return;
    if (typeof constants.O_NOFOLLOW !== 'number' || (flags & constants.O_TRUNC)) return;
    fd = openSync(join(dir.path, name), flags | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    const opened = fstatSync(fd);
    if (!opened.isFile() || !isContinuityDirectory(dir)) return;
    const current = lstatSync(join(dir.path, name));
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== opened.dev || current.ino !== opened.ino) return;
    return use(fd);
  } catch { return; }
  finally { if (fd !== undefined) closeSync(fd); }
}
