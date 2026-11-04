#!/usr/bin/env node
import { existsSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';
import { loadOptionalSqlite } from './shared/optional-sqlite.js';
import { readHookInput } from './shared/hook-input.js';
import { budgetHookOutput } from './shared/context-budget.js';

interface PreToolUseInput {
    session_id: string;
    tool_name: string;
    tool_input: Record<string, unknown>;
}

interface HookOutput {
    result: 'continue' | 'block';
    message?: string;
}

interface Broadcast {
    sender: string;
    type: string;
    payload: Record<string, unknown>;
    time: string;
}

interface BroadcastRow {
    sender_agent: string;
    broadcast_type: string;
    payload: string;
    created_at: string;
}

// Safe ID pattern: alphanumeric with hyphens/underscores, 1-64 chars
// Blocks shell metacharacters, newlines, quotes, etc.
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Query broadcasts from the coordination database using native better-sqlite3.
 *
 * Returns recent broadcasts for the given swarm, excluding messages from the
 * specified agent (self). Returns at most 10 broadcasts ordered by most recent first.
 *
 * Returns an empty array if:
 * - DB file does not exist
 * - broadcasts table does not exist
 * - query fails for any reason
 */
export function queryBroadcasts(
    dbPath: string,
    swarmId: string,
    agentId: string
): Broadcast[] {
    if (!existsSync(dbPath)) {
        return [];
    }

    const Sqlite = loadOptionalSqlite('pre-tool-use-broadcast');
    if (!Sqlite) return [];
    let db: InstanceType<typeof Database> | null = null;
    try {
        db = new Sqlite(dbPath, { readonly: true });
        db.pragma('busy_timeout = 5000');

        // Check if broadcasts table exists
        const tableExists = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='broadcasts'"
        ).get();
        if (!tableExists) {
            return [];
        }

        const rows = db.prepare(`
            SELECT sender_agent, broadcast_type, payload, created_at
            FROM broadcasts
            WHERE swarm_id = ? AND sender_agent != ?
            ORDER BY created_at DESC
            LIMIT 10
        `).all(swarmId, agentId) as BroadcastRow[];

        const broadcasts: Broadcast[] = [];
        for (const row of rows) {
            let parsedPayload: Record<string, unknown>;
            try {
                parsedPayload = JSON.parse(row.payload);
            } catch {
                // Skip rows with malformed JSON payload
                continue;
            }
            broadcasts.push({
                sender: row.sender_agent,
                type: row.broadcast_type,
                payload: parsedPayload,
                time: row.created_at,
            });
        }

        return broadcasts;
    } catch {
        console.error('[pre-tool-use-broadcast] SQLite broadcast query failed; no broadcasts were loaded.');
        return [];
    } finally {
        try { db?.close(); } catch { /* ignore */ }
    }
}

async function main() {
    try {
        readHookInput<PreToolUseInput>();
    } catch {
        console.log(JSON.stringify({ result: 'continue' }));
        return;
    }

    // Check if we're in an agentica swarm
    const swarmId = process.env.SWARM_ID;
    if (!swarmId) {
        // Not in a swarm, continue normally
        console.log(JSON.stringify({ result: 'continue' }));
        return;
    }

    // Validate SWARM_ID format to prevent injection
    if (!SAFE_ID_PATTERN.test(swarmId)) {
        console.log(JSON.stringify({ result: 'continue' }));
        return;
    }

    const agentId = process.env.AGENT_ID || 'unknown';
    // Validate AGENT_ID format if provided
    if (agentId !== 'unknown' && !SAFE_ID_PATTERN.test(agentId)) {
        console.log(JSON.stringify({ result: 'continue' }));
        return;
    }

    // Query broadcasts table for this swarm
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const dbPath = join(projectDir, '.claude', 'cache',
                        'agentica-coordination', 'coordination.db');

    if (!existsSync(dbPath)) {
        console.log(JSON.stringify({ result: 'continue' }));
        return;
    }

    try {
        const broadcasts = queryBroadcasts(dbPath, swarmId, agentId);

        if (broadcasts.length > 0) {
            let contextMessage = '\n--- SWARM BROADCASTS ---\n';
            for (const b of broadcasts) {
                contextMessage += `[${b.type.toUpperCase()}] from ${b.sender}:\n`;
                contextMessage += `  ${JSON.stringify(b.payload)}\n`;
            }
            contextMessage += '------------------------\n';

            console.log(JSON.stringify(budgetHookOutput({
                hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: contextMessage },
            }, 'pre-tool-use-broadcast', 'PreToolUse')));
        } else {
            console.log(JSON.stringify({ result: 'continue' }));
        }
    } catch (err) {
        // On error, continue without broadcasts
        console.error('Broadcast query error:', err);
        console.log(JSON.stringify({ result: 'continue' }));
    }
}

// Only run main() when executed directly (not when imported for testing)
const isDirectExecution = process.argv[1]?.endsWith('pre-tool-use-broadcast.mjs')
    || process.argv[1]?.endsWith('pre-tool-use-broadcast.ts');

if (isDirectExecution) {
    main().catch(err => {
        console.error('Uncaught error:', err);
        console.log(JSON.stringify({ result: 'continue' }));
    });
}
