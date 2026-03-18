// src/instinct-cli.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var claudeDir = join(homedir(), ".claude");
function loadRegistry() {
  const path = join(claudeDir, "instinct-projects.json");
  if (!existsSync(path)) return { projects: {}, updatedAt: "" };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { projects: {}, updatedAt: "" };
  }
}
function loadGlobal() {
  const path = join(claudeDir, "global-instincts.json");
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}
function loadProjectMature(hash) {
  if (!/^[a-f0-9]{12}$/.test(hash)) return [];
  const path = join(claudeDir, "projects", hash, "instincts", "mature-instincts.json");
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}
function loadLegacyMature() {
  const path = join(claudeDir, "mature-instincts.json");
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}
function cmdPortfolio() {
  const registry = loadRegistry();
  const projects = Object.values(registry.projects);
  if (projects.length === 0) {
    console.log("Henuz proje kaydedilmemis. Farkli projelerde session baslatin.");
    return;
  }
  console.log("=== PROJE PORTFOYU ===\n");
  console.log(`Toplam proje: ${projects.length}`);
  console.log(`Son guncelleme: ${registry.updatedAt}
`);
  console.log("  Proje               Hash         Pattern  Ilk Gorulme");
  console.log("  -----               ----         -------  -----------");
  const sorted = projects.sort((a, b) => b.patternCount - a.patternCount);
  for (const p of sorted) {
    const name = p.name.padEnd(20).slice(0, 20);
    const hash = p.hash.padEnd(12);
    const count = String(p.patternCount).padEnd(8);
    const first = p.firstSeen.slice(0, 10);
    console.log(`  ${name} ${hash} ${count} ${first}`);
  }
  const global = loadGlobal();
  if (global.length > 0) {
    console.log(`
Global promote edilmis: ${global.length} pattern`);
  }
}
function cmdGlobal() {
  const global = loadGlobal();
  if (global.length === 0) {
    console.log("Henuz global promote edilmis pattern yok.");
    console.log("Kosullar: 2+ projede gorulen, toplam 5+ tekrarlayan pattern'ler.");
    return;
  }
  console.log(`=== GLOBAL PATTERNS (${global.length} toplam) ===
`);
  for (const g of global) {
    const projectNames = g.projects.map((p) => `${p.name}(${p.count}x)`).join(", ");
    console.log(`[${g.type}] ${g.pattern}`);
    console.log(`  Toplam: ${g.totalCount}x | Projeler: ${g.projects.length}`);
    console.log(`  Kaynak: ${projectNames}`);
    if (g.examples.length > 0) {
      console.log(`  Ornek: ${g.examples[0]}`);
    }
    console.log(`  Promote: ${g.promotedAt.slice(0, 10)}`);
    console.log("");
  }
}
function cmdProject(nameOrHash) {
  if (!nameOrHash) {
    console.log("Kullanim: instinct-cli project <proje-ismi-veya-hash>");
    return;
  }
  const registry = loadRegistry();
  const projects = Object.values(registry.projects);
  const project = projects.find(
    (p) => p.name.toLowerCase() === nameOrHash.toLowerCase() || p.hash === nameOrHash
  );
  if (!project) {
    console.log(`Proje '${nameOrHash}' bulunamadi.`);
    console.log(`Mevcut projeler: ${projects.map((p) => p.name).join(", ") || "yok"}`);
    return;
  }
  const mature = loadProjectMature(project.hash);
  console.log(`=== ${project.name.toUpperCase()} ===
`);
  console.log(`Hash: ${project.hash}`);
  console.log(`Ilk gorulme: ${project.firstSeen.slice(0, 10)}`);
  console.log(`Son gorulme: ${project.lastSeen.slice(0, 10)}`);
  console.log(`Toplam pattern: ${mature.length}`);
  console.log(`Olgun (5+): ${mature.filter((m) => m.confidence >= 5).length}`);
  console.log(`Rule'a donusen (10+): ${mature.filter((m) => m.promoted).length}`);
  if (mature.length > 0) {
    console.log("\n--- Pattern'ler ---");
    const sorted = mature.sort((a, b) => b.confidence - a.confidence);
    for (const m of sorted.slice(0, 15)) {
      const badge = m.promoted ? " [RULE]" : m.confidence >= 5 ? " [MATURE]" : "";
      console.log(`  ${m.pattern} (${m.count}x)${badge}`);
    }
    if (mature.length > 15) {
      console.log(`  ... ve ${mature.length - 15} daha`);
    }
  }
}
function cmdStats() {
  const registry = loadRegistry();
  const projects = Object.values(registry.projects);
  const global = loadGlobal();
  const legacy = loadLegacyMature();
  console.log("=== INSTINCT ISTATISTIKLERI ===\n");
  console.log(`Projeler: ${projects.length}`);
  console.log(`Global pattern: ${global.length}`);
  console.log(`Legacy pattern: ${legacy.length}`);
  console.log(`Legacy olgun (5+): ${legacy.filter((m) => m.confidence >= 5).length}`);
  console.log(`Legacy rule (10+): ${legacy.filter((m) => m.promoted).length}`);
  if (projects.length > 0) {
    let totalPatterns = 0;
    let totalMature = 0;
    for (const p of projects) {
      const mature = loadProjectMature(p.hash);
      totalPatterns += mature.length;
      totalMature += mature.filter((m) => m.confidence >= 5).length;
    }
    console.log(`
Proje pattern toplam: ${totalPatterns}`);
    console.log(`Proje olgun toplam: ${totalMature}`);
  }
  if (legacy.length > 0) {
    const types = /* @__PURE__ */ new Map();
    for (const m of legacy) {
      types.set(m.type, (types.get(m.type) || 0) + 1);
    }
    console.log("\n--- Tip Dagilimi ---");
    for (const [type, count] of [...types.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`);
    }
  }
  if (global.length > 0) {
    console.log("\n--- Global Promote ---");
    for (const g of global) {
      console.log(`  ${g.pattern}: ${g.totalCount}x, ${g.projects.length} proje`);
    }
  }
}
var args = process.argv.slice(2);
var cmd = args[0] || "stats";
switch (cmd) {
  case "portfolio":
    cmdPortfolio();
    break;
  case "global":
    cmdGlobal();
    break;
  case "project":
    cmdProject(args[1] || "");
    break;
  case "stats":
    cmdStats();
    break;
  default:
    console.log("Instinct CLI - Cross-Project Learning System");
    console.log("Komutlar:");
    console.log("  portfolio      - Tum projeler ve pattern sayilari");
    console.log("  global         - Global promote edilmis pattern'ler");
    console.log("  project <isim> - Belirli projenin pattern'leri");
    console.log("  stats          - Genel istatistikler");
}
