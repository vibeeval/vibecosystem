/**
 * Hook Performance Profiler
 * Her hook'un calisma suresini olcer ve hook-perf.jsonl'e yazar.
 * Yavas hook'lari tespit etmek ve optimize etmek icin kullanilir.
 */
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { appendWithRotation } from './log-rotation.js';

const PERF_LOG = join(homedir(), '.claude', 'cache', 'hook-perf.jsonl');
const MAX_LOG_SIZE = 1024 * 1024; // 1MB

interface PerfEntry {
  ts: string;
  hook: string;
  event: string;
  duration_ms: number;
  session: string;
}

/**
 * Zamanlayici baslatir. Hook'un main() basinda cagir.
 */
export function startTimer(): bigint {
  return process.hrtime.bigint();
}

/**
 * Zamanlayiciyi durdurur ve sonucu log'a yazar.
 * Hook'un main() sonunda cagir.
 */
export function endTimer(start: bigint, hookName: string, eventType: string, sessionId = 'unknown'): void {
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  const entry: PerfEntry = {
    ts: new Date().toISOString(),
    hook: hookName,
    event: eventType,
    duration_ms: Math.round(elapsed * 100) / 100,
    session: sessionId.slice(0, 8),
  };

  try {
    const cacheDir = join(homedir(), '.claude', 'cache');
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    appendWithRotation(PERF_LOG, JSON.stringify(entry) + '\n', MAX_LOG_SIZE, 3000);
  } catch {
    // Log yazamazsa sessizce devam et - hook'u bloklamasin
  }
}
