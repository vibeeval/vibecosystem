#!/usr/bin/env node
/**
 * Import Error Detector - PostToolUse hook that detects Python import errors
 * and suggests the /environment-triage skill.
 *
 * Runs on Bash tool output, matches patterns like:
 * - ModuleNotFoundError: No module named 'X'
 * - ImportError: cannot import name 'Y'
 * - No module named 'Z'
 *
 * Returns a system reminder suggesting the skill when errors are detected.
 */
import { readHookInput } from './shared/hook-input.js';
import { budgetHookOutput } from './shared/context-budget.js';
import { hookResponseText } from './shared/hook-response.js';

interface PostToolUseInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output?: string;
  tool_response?: unknown;
  error?: string;
}

interface HookOutput {
  hookSpecificOutput: { hookEventName: 'PostToolUse'; additionalContext: string };
}

// Error patterns to detect
const IMPORT_ERROR_PATTERNS = [
  /ModuleNotFoundError:\s*No module named\s*['"]?(\w+)['"]?/i,
  /ImportError:\s*cannot import name\s*['"]?(\w+)['"]?/i,
  /ImportError:\s*No module named\s*['"]?(\w+)['"]?/i,
  /No module named\s*['"]?(\w+)['"]?/i,
  /ModuleNotFoundError/i,
  /circular import/i,
];

function detectImportError(output: string): { detected: boolean; module?: string } {
  for (const pattern of IMPORT_ERROR_PATTERNS) {
    const match = pattern.exec(output);
    if (match) {
      return {
        detected: true,
        module: match[1] || undefined,
      };
    }
  }
  return { detected: false };
}

async function main() {
  let input: PostToolUseInput;

  try {
    input = readHookInput<PostToolUseInput>();
  } catch {
    // Malformed input - continue silently
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  // Only process Bash tool output
  if (input.tool_name !== 'Bash') {
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  // Check both output and error fields
  const textToCheck = [hookResponseText(input), input.error].filter(Boolean).join('\n');

  if (!textToCheck) {
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  const result = detectImportError(textToCheck);

  if (result.detected) {
    const moduleName = result.module ? ` (module: ${result.module})` : '';
    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 IMPORT ERROR DETECTED${moduleName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Consider using /environment-triage skill to diagnose:

1. Check Python version: uv run python --version
2. Check if installed: uv pip show ${result.module || '<module>'}
3. Verify import: uv run python -c "import ${result.module || '<module>'}"

Or invoke the skill: /environment-triage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      },
    };
    console.log(JSON.stringify(budgetHookOutput(output, 'import-error-detector', 'PostToolUse:Bash')));
  } else {
    console.log(JSON.stringify({ result: 'continue' }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ result: 'continue' }));
});
