import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export type AgentMemoryScope = 'user' | 'project' | 'local';

/** One safe path component; reject dot paths before consulting agent metadata. */
export function sanitizeAgentType(agentType: string): string {
  return agentType.replace(/[:/\\\s]+/g, '-').replace(/[^a-zA-Z0-9_.-]/g, '')
    .replace(/^\.+|\.+$/g, '').toLowerCase() || 'unknown';
}

export function agentProjectDir(cwd?: string): string {
  return resolve(cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

export interface AgentMemoryDirectory {
  readonly path: string;
  readonly anchor: string;
  readonly parts: readonly string[];
}

/**
 * Resolve the trusted HOME/project anchor first (e.g. macOS /tmp -> /private/tmp),
 * then reject symlinks in every memory/metadata directory below that anchor.
 * Node has no portable openat API: concurrent hostile directory replacement is
 * still outside this best-effort path guard's guarantees.
 */
function safeDirectory(anchor: string, parts: readonly string[], create = false): AgentMemoryDirectory | undefined {
  try {
    const root = realpathSync(anchor);
    if (!lstatSync(root).isDirectory()) return;
    let path = root;
    for (const part of parts) {
      if (!part || part === '.' || part === '..' || /[/\\]/.test(part)) return;
      path = join(path, part);
      try {
        if (create) mkdirSync(path, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return;
    }
    // Detect a stable ancestor replacement between the component checks.
    if (realpathSync(path) !== path) return;
    return { path, anchor: root, parts };
  } catch { return; }
}

export function getSafeAgentMemoryDir(agentType: string, scope: AgentMemoryScope, cwd?: string, create = false): AgentMemoryDirectory | undefined {
  const anchor = scope === 'user' ? homedir() : agentProjectDir(cwd);
  return safeDirectory(anchor, ['.claude', scope === 'local' ? 'agent-memory-local' : 'agent-memory', sanitizeAgentType(agentType)], create);
}

export function isSafeAgentMemoryDir(dir: AgentMemoryDirectory): boolean {
  return safeDirectory(dir.anchor, dir.parts)?.path === dir.path;
}

/** Final files must be regular and opened without following a symlink. */
export function withAgentMemoryFile(dir: AgentMemoryDirectory, name: string, flags: number, use: (fd: number) => void): boolean {
  let fd: number | undefined;
  try {
    if (!name || name === '.' || name === '..' || /[/\\]/.test(name) || !isSafeAgentMemoryDir(dir)) return false;
    if (typeof constants.O_NOFOLLOW !== 'number') return false;
    const path = join(dir.path, name);
    // NONBLOCK avoids hanging if a regular file is replaced by a FIFO before open.
    fd = openSync(path, flags | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    const opened = fstatSync(fd);
    if (!opened.isFile() || !isSafeAgentMemoryDir(dir)) return false;
    const current = lstatSync(path);
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== opened.dev || current.ino !== opened.ino) return false;
    use(fd);
    return true;
  } catch { return false; }
  finally { if (fd !== undefined) closeSync(fd); }
}

/** Serialize cooperative journal append/retention; never wait indefinitely. */
export function withAgentMemoryLock(dir: AgentMemoryDirectory, use: () => void): boolean {
  const name = '.learnings.lock';
  const deadline = Date.now() + 1500;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  do {
    let acquired = false;
    const success = withAgentMemoryFile(dir, name, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, fd => {
      acquired = true;
      const lock = fstatSync(fd);
      try {
        writeFileSync(fd, JSON.stringify({ pid: process.pid }), 'utf-8');
        use();
      } finally {
        // Only remove our own lock; never follow or overwrite another file.
        if (isSafeAgentMemoryDir(dir)) {
          const current = lstatSync(join(dir.path, name));
          if (current.isFile() && current.dev === lock.dev && current.ino === lock.ino) unlinkSync(join(dir.path, name));
        }
      }
    });
    if (acquired) return success;
    if (!isSafeAgentMemoryDir(dir)) return false;
    // Do not automatically unlink someone else's lock: portable Node cannot
    // atomically check ownership and unlink, so concurrent stale-lock recovery
    // could remove a newly acquired lock. Abandoned locks fail closed instead.
    try {
      const current = lstatSync(join(dir.path, name));
      if (!current.isFile() || current.isSymbolicLink()) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return false;
    }
    Atomics.wait(pause, 0, 0, 10);
  } while (Date.now() < deadline);
  return false;
}

export function getAgentMemoryScope(agentType: string, cwd?: string): AgentMemoryScope {
  // Agent metadata itself must stay inside the agents directory.
  if (!/^[a-zA-Z0-9_:-]+$/.test(agentType)) return 'user';
  for (const anchor of [agentProjectDir(cwd), homedir()]) {
    const dir = safeDirectory(anchor, ['.claude', 'agents']);
    if (!dir) continue;
    let scope: AgentMemoryScope | undefined;
    withAgentMemoryFile(dir, `${agentType}.md`, constants.O_RDONLY, fd => {
      // Metadata only needs a small frontmatter block, never an arbitrary file.
      if (fstatSync(fd).size > 100_000) return;
      const frontmatter = readFileSync(fd, 'utf-8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
      scope = frontmatter?.[1].match(/^memory:\s*['"]?(user|project|local)['"]?\s*$/m)?.[1] as AgentMemoryScope | undefined;
    });
    if (scope) return scope;
  }
  return 'user';
}

export function getAgentMemoryDir(agentType: string, scope: AgentMemoryScope, cwd?: string): string {
  const name = sanitizeAgentType(agentType);
  if (scope === 'user') return join(homedir(), '.claude', 'agent-memory', name);
  return join(agentProjectDir(cwd), '.claude', scope === 'local' ? 'agent-memory-local' : 'agent-memory', name);
}
