/**
 * Dashboard WebSocket Emitter - PostToolUse hook
 * Agent spawn, error, completion event'lerini ws://localhost:3847 adresine yayinlar.
 * Dashboard opsiyonel - baglanti yoksa sessizce devam eder.
 */
import { readFileSync } from 'fs';
import { request } from 'node:http';

interface PostToolInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response?: unknown;
}

interface DashboardEvent {
  type: 'agent_spawn' | 'agent_complete' | 'agent_error' | 'hook_fire' | 'tool_call';
  timestamp: string;
  sessionId: string;
  agentType?: string;
  agentId?: string;
  taskId?: string;
  duration?: number;
  status: 'running' | 'done' | 'error';
  metadata: Record<string, unknown>;
}

// Only structural metadata is sent. Prompts, shell commands and tool inputs can
// contain credentials and are unnecessary for local activity monitoring.
export function extractAgentInfo(input: PostToolInput): Partial<DashboardEvent> {
  const ti = input.tool_input || {};
  const response = input.tool_response;
  const object = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const hasError = object.is_error === true || object.isError === true ||
    typeof object.exitCode === 'number' && object.exitCode !== 0 ||
    typeof object.exit_code === 'number' && object.exit_code !== 0;
  if (input.tool_name === 'Agent' || input.tool_name === 'Task') {
    const agentType = typeof ti.subagent_type === 'string' ? ti.subagent_type
      : typeof ti.type === 'string' ? ti.type : 'unknown';
    const hasResponse = response !== undefined && response !== null;
    return {
      type: hasError ? 'agent_error' : hasResponse ? 'agent_complete' : 'agent_spawn',
      agentType: agentType.slice(0, 128),
      status: hasError ? 'error' : hasResponse ? 'done' : 'running',
      metadata: { tool: input.tool_name },
    };
  }
  return {
    type: 'tool_call',
    status: hasError ? 'error' : 'done',
    metadata: { tool: input.tool_name },
  };
}

function sendToWebSocket(event: DashboardEvent): Promise<void> {
  const port = Number(process.env.VIBECO_DASHBOARD_WS_PORT || 3847);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.resolve();
  return new Promise((resolve) => {
    // Raw TCP ile WebSocket frame gonderme yerine,
    // basit UDP-like fire-and-forget HTTP POST kullaniyoruz
    // Dashboard server bunu alip WS client'lara broadcast eder
    const payload = JSON.stringify(event);
    const postData = Buffer.from(payload);

    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length,
        },
        timeout: 500,
      },
      response => { response.resume(); resolve(); }
    );

    req.on('error', () => resolve()); // Sessizce devam et
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(postData);
    req.end();
  });
}

async function main() {
  let raw = '';
  try { raw = readFileSync(0, 'utf-8'); } catch { return; }
  if (!raw) { console.log('{}'); return; }

  let input: PostToolInput;
  try {
    input = JSON.parse(raw);
    if (!input || typeof input.tool_name !== 'string' || !input.tool_input ||
        typeof input.tool_input !== 'object' || Array.isArray(input.tool_input)) {
      console.log('{}'); return;
    }
  } catch { console.log('{}'); return; }

  // Sadece ilginc event'leri gonder (Agent, Task, Bash, Edit, Write)
  const interestingTools = ['Agent', 'Task', 'Bash', 'Edit', 'Write', 'Read', 'Grep', 'Glob'];
  if (!interestingTools.includes(input.tool_name)) {
    console.log('{}');
    return;
  }

  const partial = extractAgentInfo(input);

  const event: DashboardEvent = {
    type: partial.type || 'tool_call',
    timestamp: new Date().toISOString(),
    sessionId: (typeof input.session_id === 'string' ? input.session_id : 'unknown').slice(0, 128),
    agentType: partial.agentType || undefined,
    agentId: process.env.CLAUDE_AGENT_ID || undefined,
    status: partial.status || 'done',
    metadata: partial.metadata || {},
  };

  // Fire-and-forget: Dashboard'a gonder, yoksa skip et
  await sendToWebSocket(event);

  console.log('{}');
}

main();
