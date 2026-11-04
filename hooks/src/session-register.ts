/**
 * SessionStart Hook - Registers session in coordination layer.
 *
 * This hook:
 * 1. Registers the session in PostgreSQL for cross-session awareness
 * 2. Injects a system reminder about coordination layer features
 * 3. Shows other active sessions working on the same project
 *
 * Part of the coordination layer architecture (Phase 1).
 */

import { readHookInput } from './shared/hook-input.js';
import { registerSession, getActiveSessions } from './shared/db-utils-pg.js';
import { generateSessionId, writeSessionId, getProject } from './shared/session-id.js';
import { resetBudget, budgetHookOutput } from './shared/context-budget.js';
import type { SessionStartInput } from './shared/types.js';

/**
 * Main entry point for the SessionStart hook.
 * Registers the session, persists the ID to file, and injects awareness message.
 */
export function main(): void {
  // Read hook input from stdin
  let input: SessionStartInput;
  try {
    input = readHookInput<SessionStartInput>();
  } catch {
    // If we can't read input, just continue silently
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  const sessionId = input.session_id || generateSessionId();
  const project = input.cwd || getProject();
  const projectName = project.split('/').pop() || 'unknown';

  // Store session ID in environment and file for other hooks
  process.env.COORDINATION_SESSION_ID = sessionId;
  // Context budget'i sifirla
  try {
    if (input.source === 'startup' || input.source === 'clear') resetBudget(sessionId);
  } catch { /* ok */ }
  if (!writeSessionId(sessionId)) {
    console.error(`[session-register] WARNING: Failed to persist session ID ${sessionId} to file`);
  }

  // Register session in PostgreSQL
  const registerResult = registerSession(sessionId, project, '');
  if (!registerResult.success) {
    console.error('[session-register] Coordination registration unavailable; session was not registered.');
    console.log('{}');
    return;
  }

  // Get other active sessions
  const sessionsResult = getActiveSessions(project);
  if (!sessionsResult.success) {
    console.error('[session-register] Session registered, but active peers could not be queried.');
    console.log('{}');
    return;
  }
  const otherSessions = sessionsResult.sessions.filter(s => s.id !== sessionId);

  const peers = otherSessions.slice(0, 10)
    .map(s => `- ${s.id}: ${(s.working_on || 'working').slice(0, 120)}`).join('\n');
  const awarenessMessage = `Coordination: ${projectName}; session ${sessionId}; ${otherSessions.length} active peer(s).${peers ? `\n${peers}` : ''}`;
  const output = {
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: awarenessMessage },
  };
  console.log(JSON.stringify(budgetHookOutput(output, 'session-register', 'SessionStart')));
}

// Run if executed directly
main();
