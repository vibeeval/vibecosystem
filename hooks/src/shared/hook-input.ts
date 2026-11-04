/** Claude command hooks receive a JSON object on stdin, never argv. */
import { readFileSync } from 'node:fs';
import { configureContextBudget } from './context-budget.js';

export function readHookInput<T>(raw = readFileSync(0, 'utf-8')): T {
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Hook input must be a JSON object');
  }
  configureContextBudget(input as Record<string, unknown>);
  return input as T;
}

export { hookResponseText } from './hook-response.js';
