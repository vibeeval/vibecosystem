/**
 * Standalone transcript parser CLI and compatibility exports.
 * Hooks import the shared module so bundled consumers never execute this CLI.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseTranscript, generateAutoHandoff } from './shared/transcript-parser.js';

export * from './shared/transcript-parser.js';

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    // Node resolves entry-point symlinks; compare canonical paths on both sides.
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

// npx tsx transcript-parser.ts /path/to/transcript.jsonl [session-name]
if (isDirectExecution()) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: npx tsx transcript-parser.ts <transcript-path> [session-name]');
    process.exit(1);
  }

  const transcriptPath = args[0];
  const sessionName = args[1] || 'test-session';

  console.log(`Parsing transcript: ${transcriptPath}`);
  const summary = parseTranscript(transcriptPath);

  console.log('\n--- Summary ---');
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n--- Auto-Handoff ---');
  console.log(generateAutoHandoff(summary, sessionName));
}
