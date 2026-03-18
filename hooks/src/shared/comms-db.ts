/**
 * Comms DB - Database operations for agent communication.
 *
 * Stub implementation. The actual DB operations are provided
 * by the coordination layer (PostgreSQL/SQLite).
 */

import type {
  AgentState,
  AgentStatus,
  Message,
  SendMessageInput,
  InboxQuery,
} from './comms-types.js';

export function upsertAgentState(
  agentId: string,
  agentType: string,
  sessionId: string,
  status: AgentStatus,
  task?: string
): AgentState {
  return {
    agent_id: agentId,
    agent_type: agentType,
    session_id: sessionId,
    status,
    task,
  };
}

export function getAgentState(_agentId: string): AgentState | null {
  return null;
}

export function getActiveAgents(_sessionId: string): AgentState[] {
  return [];
}

export function queryAgentStates(_filters: { session_id?: string }): AgentState[] {
  return [];
}

export function sendMessage(input: SendMessageInput): Message {
  return {
    id: Date.now(),
    sender: input.sender,
    recipient: input.recipient,
    topic: input.topic,
    subject: input.subject,
    body: input.body,
    priority: input.priority,
    session_id: input.session_id,
    in_reply_to: input.in_reply_to,
    expires_at: input.expires_at,
  };
}

export function getInbox(_query: InboxQuery): Message[] {
  return [];
}

export function markAsRead(_messageId: number, _agentType: string): void {
  // no-op
}

export function getMessageById(_messageId: number): Message | null {
  return null;
}

export function getMessageThread(_messageId: number): Message[] {
  return [];
}

export function subscribe(_agentType: string, _topic: string): void {
  // no-op
}

export function unsubscribe(_agentType: string, _topic: string): void {
  // no-op
}

export function getSubscriptions(_agentType: string): string[] {
  return [];
}

export function getTopicSubscribers(_topic: string): string[] {
  return [];
}

export function cleanupOldMessages(_ttlDays?: number): number {
  return 0;
}

export function getStats(): Record<string, unknown> {
  return {};
}

export function loadSubscriptionsFromConfig(_config: Record<string, string[]>): void {
  // no-op
}

export function closeDb(): void {
  // no-op
}
