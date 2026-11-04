/**
 * token-tracker.ts - Token Usage Tracker
 *
 * PostToolUse hook that estimates token usage per tool call
 * and writes to ~/.claude/token-usage.jsonl for dashboard consumption.
 *
 * Also broadcasts to dashboard WebSocket if running.
 */

import { hookResponseText } from './shared/hook-response.js';
import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface ToolEvent {
  tool_name: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  tool_response?: unknown;
  session_id?: string;
  usage?: TokenUsage;
  token_usage?: TokenUsage;
  metadata?: { usage?: TokenUsage };
}

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface TokenEntry {
  timestamp: string;
  session_id: string;
  tool: string;
  input_chars: number;
  output_chars: number;
  total_chars: number;
  input_tokens_est: number;
  output_tokens_est: number;
  total_tokens_est: number;
  token_source: 'provider' | 'estimate' | 'mixed';
  input_token_source: 'provider' | 'estimate';
  output_token_source: 'provider' | 'estimate';
  total_token_source: 'provider' | 'estimate' | 'mixed';
  agent?: string;
}

// Conservative fallback. These are estimates unless the hook event supplies usage.
function charCount(text: string | undefined): number {
  if (!text) return 0;
  return String(text).length;
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function getUsage(event: ToolEvent): TokenUsage | undefined {
  return event.usage || event.token_usage || event.metadata?.usage;
}

function runHook(): void {
  let input: string;
  try {
    input = readFileSync(0, 'utf-8');
  } catch { return; }

  let event: ToolEvent;
  try {
    event = JSON.parse(input);
  } catch { return; }

  const claudeDir = join(homedir(), '.claude');
  const logFile = join(claudeDir, 'token-usage.jsonl');

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  const inputChars = charCount(JSON.stringify(event.tool_input || {}));
  const outputChars = charCount(hookResponseText(event));
  const usage = getUsage(event);
  const providerInput = Number(usage?.input_tokens);
  const providerOutput = Number(usage?.output_tokens);
  const providerTotal = Number(usage?.total_tokens);
  const hasProviderInput = typeof usage?.input_tokens === 'number' && Number.isFinite(providerInput) && providerInput >= 0;
  const hasProviderOutput = typeof usage?.output_tokens === 'number' && Number.isFinite(providerOutput) && providerOutput >= 0;
  const hasProviderTotal = typeof usage?.total_tokens === 'number' && Number.isFinite(providerTotal) && providerTotal >= 0;
  const inputTokens = hasProviderInput ? providerInput : estimateTokens(inputChars);
  const outputTokens = hasProviderOutput ? providerOutput : estimateTokens(outputChars);
  const totalTokens = hasProviderTotal ? providerTotal : inputTokens + outputTokens;
  const inputSource = hasProviderInput ? 'provider' : 'estimate';
  const outputSource = hasProviderOutput ? 'provider' : 'estimate';
  const totalSource = hasProviderTotal
    ? 'provider'
    : inputSource === 'estimate' && outputSource === 'estimate' ? 'estimate' : 'mixed';

  const entry: TokenEntry = {
    timestamp: new Date().toISOString(),
    session_id: event.session_id || 'unknown',
    tool: event.tool_name,
    input_chars: inputChars,
    output_chars: outputChars,
    total_chars: inputChars + outputChars,
    input_tokens_est: inputTokens,
    output_tokens_est: outputTokens,
    total_tokens_est: totalTokens,
    token_source: totalSource,
    input_token_source: inputSource,
    output_token_source: outputSource,
    total_token_source: totalSource,
  };

  if (event.tool_name === 'Agent' && event.tool_input) {
    entry.agent = String(event.tool_input.subagent_type || 'general-purpose');
  }

  try {
    appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch { /* silent */ }
}

try { runHook(); } catch { process.exit(0); }
