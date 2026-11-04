import { describe, expect, it } from 'vitest';
import { extractAgentInfo } from '../dashboard-ws-emitter.js';

describe('dashboard structural event metadata', () => {
  it('does not copy prompts or shell commands into events', () => {
    const agent = extractAgentInfo({ session_id: 'test', tool_name: 'Agent',
      tool_input: { subagent_type: 'reviewer', prompt: 'sensitive fixture' }, tool_response: 'fixed the error' });
    expect(agent).toEqual({ type: 'agent_complete', agentType: 'reviewer', status: 'done', metadata: { tool: 'Agent' } });
    const bash = extractAgentInfo({ session_id: 'test', tool_name: 'Bash',
      tool_input: { command: 'sensitive fixture' }, tool_response: { stdout: 'sensitive fixture', exitCode: 0 } });
    expect(bash.metadata).toEqual({ tool: 'Bash' });
    expect(JSON.stringify([agent, bash])).not.toContain('sensitive fixture');
  });
  it('uses structured failure fields instead of matching words in successful responses', () => {
    expect(extractAgentInfo({ session_id: 'test', tool_name: 'Bash', tool_input: {}, tool_response: { exitCode: 2 } }).status).toBe('error');
    expect(extractAgentInfo({ session_id: 'test', tool_name: 'Agent', tool_input: {}, tool_response: { is_error: true } }).type).toBe('agent_error');
    expect(extractAgentInfo({ session_id: 'test', tool_name: 'Agent', tool_input: {}, tool_response: 'No errors or failed checks' }).status).toBe('done');
  });
});
