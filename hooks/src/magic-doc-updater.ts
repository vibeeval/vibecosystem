/**
 * Magic Doc Updater - Stop hook
 *
 * Session sonunda tracked magic doc'lari kontrol eder.
 * Guncellenecek doc varsa systemMessage ile bildirir.
 *
 * Gercek guncelleme Claude'un kendisi yapar (systemMessage ile talimat verilir).
 * Bu hook sadece hangi dosyalarin guncellenmesi gerektigini bildirir.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const MAGIC_DOC_DIR = join(homedir(), '.claude', 'magic-docs');
const TRACKED_FILE = join(MAGIC_DOC_DIR, 'tracked.json');

interface TrackedDoc {
  path: string;
  title: string;
  instructions?: string;
  firstSeen: string;
  lastSeen: string;
}

function loadTracked(): Record<string, TrackedDoc> {
  try {
    if (existsSync(TRACKED_FILE)) {
      return JSON.parse(readFileSync(TRACKED_FILE, 'utf-8'));
    }
  } catch {
    // corrupt
  }
  return {};
}

function main() {
  try {
    const tracked = loadTracked();
    const docs = Object.values(tracked);

    if (docs.length === 0) return;

    // Session icinde okunan doc'lari listele
    const docList = docs
      .map(d => {
        const instr = d.instructions ? ` (instructions: "${d.instructions}")` : '';
        return `- **${d.title}**: \`${d.path}\`${instr}`;
      })
      .join('\n');

    const message = `## Magic Docs - Session Sonu Guncelleme

Bu session'da su Magic Doc dosyalari okundu:

${docList}

Bu dosyalari konusmadan elde edilen yeni bilgilerle guncelle:
- Sadece yeni ve degerli bilgi varsa guncelle
- "# MAGIC DOC:" header'ini AYNEN koru
- Eski/yanlis bilgiyi duzelt, yenisiyle degistir
- Changelog/tarihce EKLEME, mevcut durumu yansit
- Kisa, oz, yuksek sinyal iceren icerik yaz`;

    // tracked.json'u temizle (bir sonraki session icin)
    writeFileSync(TRACKED_FILE, '{}', 'utf-8');

    const result = {
      systemMessage: message,
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
    // sessiz
  }
}

main();
