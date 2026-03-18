/**
 * Log Rotation Utility
 * Append to log files with automatic size-based rotation.
 * When file exceeds maxBytes, keeps only the last keepLines lines.
 * Uses atomic rename to prevent data loss during concurrent access.
 */
import { statSync, readFileSync, writeFileSync, appendFileSync, renameSync, unlinkSync } from 'fs';

export function appendWithRotation(
  filePath: string,
  line: string,
  maxBytes: number = 2 * 1024 * 1024,
  keepLines: number = 5000
): void {
  // Append first to ensure the line is never lost
  appendFileSync(filePath, line);

  try {
    const stats = statSync(filePath);
    if (stats.size > maxBytes) {
      const tmpPath = filePath + '.rotating';
      try {
        // Atomic rename prevents concurrent rotation conflicts
        renameSync(filePath, tmpPath);
        const content = readFileSync(tmpPath, 'utf-8');
        const lines = content.split('\n').filter(l => l.length > 0);
        writeFileSync(filePath, lines.slice(-keepLines).join('\n') + '\n');
        unlinkSync(tmpPath);
      } catch {
        // Another process already rotating — safe to ignore
      }
    }
  } catch { /* file doesn't exist yet or stat failed — safe to ignore */ }
}
