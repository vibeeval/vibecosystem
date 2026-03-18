/**
 * Notification Bridge - macOS bildirim sistemi
 * Kritik olaylarda (build fail, instinct promotion) masaustu bildirimi gonderir.
 */
import { execFileSync } from 'child_process';

type NotifyLevel = 'info' | 'warning' | 'critical';

/**
 * macOS bildirimi gonderir.
 * Basarisiz olursa sessizce devam eder - hook'u bloklamaz.
 */
export function notify(title: string, message: string, level: NotifyLevel = 'info'): void {
  try {
    const subtitle = level === 'critical' ? 'CRITICAL' : level === 'warning' ? 'WARNING' : '';
    const script = `display notification "${esc(message)}" with title "${esc(title)}" ${subtitle ? `subtitle "${esc(subtitle)}"` : ''} sound name "Submarine"`;
    execFileSync('osascript', ['-e', script], { timeout: 2000, stdio: 'ignore' });
  } catch {
    // Bildirim gonderilemezse sessizce devam et
  }
}

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .slice(0, 200);
}
