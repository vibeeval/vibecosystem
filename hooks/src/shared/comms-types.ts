/**
 * Comms Types - Type definitions for agent communication.
 *
 * Used by comms.ts (MessageBus) and comms-db.ts.
 */

export type AgentStatus = 'active' | 'idle' | 'completed' | 'failed';

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentState {
  agent_id: string;
  agent_type: string;
  session_id: string;
  status: AgentStatus;
  task?: string;
  last_seen?: string;
}

export interface Message {
  id: number;
  sender: string;
  recipient: string;
  topic: string;
  subject: string;
  body: string;
  priority?: MessagePriority;
  session_id?: string;
  in_reply_to?: number;
  expires_at?: string;
  created_at?: string;
  read_by?: string[];
}

export interface SendMessageInput {
  sender: string;
  recipient: string;
  topic: string;
  subject: string;
  body: string;
  priority?: MessagePriority;
  session_id?: string;
  in_reply_to?: number;
  expires_at?: string;
}

export interface InboxQuery {
  agent_type: string;
  session_id?: string;
  unread_only?: boolean;
  limit?: number;
  since_minutes?: number;
}
