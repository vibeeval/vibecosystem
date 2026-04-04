// src/magic-doc-updater.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var MAGIC_DOC_DIR = join(homedir(), ".claude", "magic-docs");
var TRACKED_FILE = join(MAGIC_DOC_DIR, "tracked.json");
function loadTracked() {
  try {
    if (existsSync(TRACKED_FILE)) {
      return JSON.parse(readFileSync(TRACKED_FILE, "utf-8"));
    }
  } catch {
  }
  return {};
}
function main() {
  try {
    const tracked = loadTracked();
    const docs = Object.values(tracked);
    if (docs.length === 0) return;
    const docList = docs.map((d) => {
      const instr = d.instructions ? ` (instructions: "${d.instructions}")` : "";
      return `- **${d.title}**: \`${d.path}\`${instr}`;
    }).join("\n");
    const message = `## Magic Docs - Session Sonu Guncelleme

Bu session'da su Magic Doc dosyalari okundu:

${docList}

Bu dosyalari konusmadan elde edilen yeni bilgilerle guncelle:
- Sadece yeni ve degerli bilgi varsa guncelle
- "# MAGIC DOC:" header'ini AYNEN koru
- Eski/yanlis bilgiyi duzelt, yenisiyle degistir
- Changelog/tarihce EKLEME, mevcut durumu yansit
- Kisa, oz, yuksek sinyal iceren icerik yaz`;
    writeFileSync(TRACKED_FILE, "{}", "utf-8");
    const result = {
      systemMessage: message
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
  }
}
main();
