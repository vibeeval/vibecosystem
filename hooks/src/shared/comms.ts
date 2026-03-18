/**
 * Agent Comms - MessageBus Facade
 *
 * High-level API for agent-to-agent communication.
 * Wraps comms-db operations with convenience methods.
 */

import {
  upsertAgentState,
  getAgentState,
  getActiveAgents,
  queryAgentStates,
  sendMessage,
  getInbox,
  markAsRead,
  getMessageById,
  getMessageThread,
  subscribe,
  unsubscribe,
  getSubscriptions,
  getTopicSubscribers,
  cleanupOldMessages,
  getStats,
  loadSubscriptionsFromConfig,
  closeDb,
} from './comms-db.js';

import type {
  AgentState,
  AgentStatus,
  Message,
  SendMessageInput,
  MessagePriority,
  InboxQuery,
} from './comms-types.js';

// =============================================================================
// MessageBus - Main API
// =============================================================================

export class MessageBus {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // ---- Agent State ----

  registerAgent(agentId: string, agentType: string, task?: string): AgentState {
    return upsertAgentState(agentId, agentType, this.sessionId, 'active', task);
  }

  updateAgentStatus(agentId: string, agentType: string, status: AgentStatus, task?: string): AgentState {
    return upsertAgentState(agentId, agentType, this.sessionId, status, task);
  }

  completeAgent(agentId: string, agentType: string, failed: boolean = false): AgentState {
    return upsertAgentState(agentId, agentType, this.sessionId, failed ? 'failed' : 'completed');
  }

  getAgent(agentId: string): AgentState | null {
    return getAgentState(agentId);
  }

  getActiveAgents(): AgentState[] {
    return getActiveAgents(this.sessionId);
  }

  getAllAgents(): AgentState[] {
    return queryAgentStates({ session_id: this.sessionId });
  }

  // ---- Messaging ----

  send(
    sender: string,
    recipient: string,
    topic: string,
    subject: string,
    body: string,
    options?: { priority?: MessagePriority; replyTo?: number; expiresAt?: string }
  ): Message {
    return sendMessage({
      sender,
      recipient,
      topic,
      subject,
      body,
      priority: options?.priority,
      session_id: this.sessionId,
      in_reply_to: options?.replyTo,
      expires_at: options?.expiresAt,
    });
  }

  broadcast(
    sender: string,
    topic: string,
    subject: string,
    body: string,
    priority?: MessagePriority
  ): Message {
    return this.send(sender, '*', topic, subject, body, { priority });
  }

  reply(messageId: number, sender: string, body: string): Message | null {
    const original = getMessageById(messageId);
    if (!original) return null;

    return this.send(
      sender,
      original.sender, // reply goes to original sender
      original.topic,
      `Re: ${original.subject}`,
      body,
      { replyTo: messageId }
    );
  }

  getInbox(agentType: string, options?: Partial<InboxQuery>): Message[] {
    return getInbox({
      agent_type: agentType,
      session_id: options?.session_id ?? this.sessionId,
      unread_only: options?.unread_only ?? false,
      limit: options?.limit ?? 20,
      since_minutes: options?.since_minutes ?? 30,
    });
  }

  getUnreadInbox(agentType: string, limit?: number): Message[] {
    return getInbox({
      agent_type: agentType,
      session_id: this.sessionId,
      unread_only: true,
      limit: limit ?? 5,
      since_minutes: 30,
    });
  }

  markRead(messageId: number, agentType: string): void {
    markAsRead(messageId, agentType);
  }

  getThread(messageId: number): Message[] {
    return getMessageThread(messageId);
  }

  // ---- Subscriptions ----

  subscribe(agentType: string, topic: string): void {
    subscribe(agentType, topic);
  }

  unsubscribe(agentType: string, topic: string): void {
    unsubscribe(agentType, topic);
  }

  getSubscriptions(agentType: string) {
    return getSubscriptions(agentType);
  }

  getTopicSubscribers(topic: string): string[] {
    return getTopicSubscribers(topic);
  }

  loadSubscriptions(config: Record<string, string[]>): void {
    loadSubscriptionsFromConfig(config);
  }

  // ---- Maintenance ----

  cleanup(ttlDays?: number): number {
    return cleanupOldMessages(ttlDays);
  }

  getStats() {
    return getStats();
  }

  close(): void {
    closeDb();
  }
}

// =============================================================================
// Default Subscriptions
// =============================================================================

export const DEFAULT_SUBSCRIPTIONS: Record<string, string[]> = {
  'scout': ['research-request', 'codebase-question'],
  'architect': ['design-question', 'plan-review', 'architecture-decision'],
  'kraken': ['plan-ready', 'implementation-request'],
  'security-reviewer': ['security-finding', 'review-request'],
  'code-reviewer': ['review-request', 'code-quality'],
  'tdd-guide': ['test-request', 'coverage-report'],
  'build-error-resolver': ['build-error', 'type-error'],
  'verifier': ['verification-request', 'quality-gate'],
  'self-learner': ['error-occurred', 'lesson-learned'],
  'sleuth': ['bug-report', 'investigation-request'],
  'spark': ['quick-fix', 'small-task'],
  'maestro': ['*'], // maestro sees everything
  'planner': ['plan-request', 'feature-request'],
  'doc-updater': ['docs-update', 'codemap-update'],
  'refactor-cleaner': ['dead-code', 'refactor-request'],
  'e2e-runner': ['e2e-request', 'test-journey'],
};
