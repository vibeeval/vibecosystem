/** Text extraction for official Claude PostToolUse responses and legacy adapters. */
export interface ToolResponseInput {
  tool_response?: unknown;
  /** Compatibility for older integrations; Claude uses tool_response. */
  tool_output?: unknown;
}

function responseText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(responseText).filter(Boolean).join('\n');
  if (typeof value !== 'object') return String(value);

  const object = value as Record<string, unknown>;
  // Bash stdout/stderr, Read file.content, Agent/MCP text content blocks.
  if ('stdout' in object || 'stderr' in object) {
    return [object.stdout, object.stderr].map(responseText).filter(Boolean).join('\n');
  }
  if ('text' in object) return responseText(object.text);
  if ('content' in object) return responseText(object.content);
  if ('file' in object) return responseText(object.file);
  if (object.type === 'image' || object.type === 'image_url') return '';
  return JSON.stringify(value);
}

/** Prefer the official response field, including an explicitly empty response. */
export function hookResponseText(input: ToolResponseInput): string {
  return responseText(input.tool_response !== undefined ? input.tool_response : input.tool_output);
}
