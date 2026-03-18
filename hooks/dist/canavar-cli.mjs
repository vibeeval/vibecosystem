// src/canavar-cli.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var canavarDir = join(homedir(), ".claude", "canavar");
var matrixPath = join(canavarDir, "skill-matrix.json");
var ledgerPath = join(canavarDir, "error-ledger.jsonl");
function loadMatrix() {
  if (!existsSync(matrixPath)) return { agents: {}, updated_at: "" };
  try {
    return JSON.parse(readFileSync(matrixPath, "utf-8"));
  } catch {
    return { agents: {}, updated_at: "" };
  }
}
function loadErrors() {
  if (!existsSync(ledgerPath)) return [];
  const lines = readFileSync(ledgerPath, "utf-8").split("\n").filter((l) => l.trim());
  const results = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch {
    }
  }
  return results;
}
function recentErrors(days = 7) {
  const cutoff = /* @__PURE__ */ new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return loadErrors().filter((e) => new Date(e.ts) >= cutoff);
}
function cmdReport() {
  const matrix = loadMatrix();
  const errors = loadErrors();
  const recent = recentErrors();
  const agents = Object.entries(matrix.agents);
  console.log("=== CANAVAR RAPOR ===\n");
  console.log(`Toplam agent: ${agents.length}`);
  console.log(`Toplam hata (tum zamanlar): ${errors.length}`);
  console.log(`Son 7 gun hata: ${recent.length}`);
  console.log(`Son guncelleme: ${matrix.updated_at || "henuz yok"}
`);
  if (agents.length > 0) {
    console.log("--- Agent Ozeti ---");
    const sorted = agents.sort((a, b) => b[1].total_tasks - a[1].total_tasks);
    for (const [name, profile] of sorted.slice(0, 10)) {
      const rate = (profile.success_rate * 100).toFixed(0);
      console.log(`  ${name}: ${profile.total_tasks} gorev, %${rate} basari, ${profile.failures} hata`);
    }
  }
  if (recent.length > 0) {
    console.log("\n--- Son 7 Gun Hatalar ---");
    const patternCounts = /* @__PURE__ */ new Map();
    for (const e of recent) {
      const key = `${e.agent_type}: ${e.error_pattern}`;
      patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
    }
    const sorted = [...patternCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sorted.slice(0, 10)) {
      console.log(`  [${count}x] ${key}`);
    }
  }
}
function cmdAgent(name) {
  const matrix = loadMatrix();
  const profile = matrix.agents[name];
  if (!profile) {
    console.log(`Agent '${name}' bulunamadi.`);
    console.log(`Mevcut agent'lar: ${Object.keys(matrix.agents).join(", ") || "henuz yok"}`);
    return;
  }
  console.log(`=== ${name.toUpperCase()} PROFILI ===
`);
  console.log(`Toplam gorev: ${profile.total_tasks}`);
  console.log(`Basari: ${profile.successes} | Hata: ${profile.failures}`);
  console.log(`Basari orani: %${(profile.success_rate * 100).toFixed(0)}`);
  console.log(`Son aktif: ${profile.last_active || "bilinmiyor"}`);
  const skills = Object.entries(profile.skills);
  if (skills.length > 0) {
    console.log("\n--- Skill'ler ---");
    for (const [skill, stats] of skills) {
      console.log(`  ${skill}: ${stats.attempts} deneme, %${(stats.rate * 100).toFixed(0)} basari`);
    }
  }
  if (profile.common_errors.length > 0) {
    console.log("\n--- Sik Hatalar ---");
    for (const err of profile.common_errors) {
      console.log(`  - ${err}`);
    }
  }
}
function cmdErrors() {
  const recent = recentErrors();
  if (recent.length === 0) {
    console.log("Son 7 gunde hata yok.");
    return;
  }
  console.log(`=== SON 7 GUN HATALARI (${recent.length} toplam) ===
`);
  const patternCounts = /* @__PURE__ */ new Map();
  for (const e of recent) {
    const existing = patternCounts.get(e.error_pattern);
    if (existing) {
      existing.count++;
      existing.agents.add(e.agent_type);
      if (existing.lessons.length < 2 && !existing.lessons.includes(e.lesson)) {
        existing.lessons.push(e.lesson);
      }
    } else {
      patternCounts.set(e.error_pattern, {
        count: 1,
        lessons: [e.lesson],
        agents: /* @__PURE__ */ new Set([e.agent_type])
      });
    }
  }
  const sorted = [...patternCounts.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [pattern, data] of sorted) {
    const agents = [...data.agents].join(", ");
    console.log(`[${data.count}x] ${pattern} (${agents})`);
    for (const lesson of data.lessons) {
      console.log(`  -> ${lesson}`);
    }
  }
}
function cmdWeak() {
  const matrix = loadMatrix();
  const agents = Object.entries(matrix.agents).filter(([, p]) => p.total_tasks >= 2).sort((a, b) => a[1].success_rate - b[1].success_rate);
  if (agents.length === 0) {
    console.log("Yeterli veri yok (en az 2 gorev gerekli).");
    return;
  }
  console.log("=== EN ZAYIF AGENT'LAR ===\n");
  for (const [name, profile] of agents.slice(0, 5)) {
    const rate = (profile.success_rate * 100).toFixed(0);
    console.log(`${name}: %${rate} basari (${profile.failures}/${profile.total_tasks} hata)`);
    if (profile.common_errors.length > 0) {
      console.log(`  Zayif noktalar: ${profile.common_errors.join(", ")}`);
    }
    const weakSkills = Object.entries(profile.skills).filter(([, s]) => s.rate < 0.7 && s.attempts >= 2).sort((a, b) => a[1].rate - b[1].rate);
    if (weakSkills.length > 0) {
      console.log(`  Zayif skill'ler: ${weakSkills.map(([s, st]) => `${s}(%${(st.rate * 100).toFixed(0)})`).join(", ")}`);
    }
  }
}
function cmdLeaderboard() {
  const matrix = loadMatrix();
  const agents = Object.entries(matrix.agents).filter(([, p]) => p.total_tasks >= 1).sort((a, b) => {
    if (b[1].success_rate !== a[1].success_rate) return b[1].success_rate - a[1].success_rate;
    return b[1].total_tasks - a[1].total_tasks;
  });
  if (agents.length === 0) {
    console.log("Henuz veri yok.");
    return;
  }
  console.log("=== AGENT LEADERBOARD ===\n");
  console.log("  #  Agent              Gorev  Basari  Hata  Oran");
  console.log("  -- ----               -----  ------  ----  ----");
  agents.forEach(([name, profile], i) => {
    const rank = i + 1;
    const rate = (profile.success_rate * 100).toFixed(0);
    const medal = rank <= 3 ? ["1.", "2.", "3."][i] : `${rank}.`;
    console.log(`  ${medal.padEnd(3)} ${name.padEnd(18)} ${String(profile.total_tasks).padEnd(6)} ${String(profile.successes).padEnd(7)} ${String(profile.failures).padEnd(5)} %${rate}`);
  });
}
function cmdTune() {
  const cacheDir = join(homedir(), ".claude", "cache");
  const reportPath = join(cacheDir, "tuning-recommendations.json");
  if (!existsSync(reportPath)) {
    console.log('Tuning raporu bulunamadi. Once "node dist/agent-tuner.mjs" calistirin.');
    return;
  }
  try {
    const report = JSON.parse(readFileSync(reportPath, "utf-8"));
    console.log(`=== TUNING ONERILERI (${report.ts}) ===
`);
    console.log(`Toplam: ${report.recommendations?.length || 0} oneri
`);
    for (const rec of report.recommendations || []) {
      const icon = rec.action === "retrain" ? "[!]" : rec.action === "specialize" ? "[~]" : rec.action === "reassign" ? "[-]" : "[+]";
      console.log(`${icon} ${rec.agent} \u2192 ${rec.action.toUpperCase()} (${rec.priority})`);
      console.log(`   ${rec.reason}`);
      console.log(`   ${rec.details}
`);
    }
  } catch (e) {
    console.log("Tuning raporu okunamadi:", e);
  }
}
var args = process.argv.slice(2);
var cmd = args[0] || "report";
switch (cmd) {
  case "report":
    cmdReport();
    break;
  case "agent":
    cmdAgent(args[1] || "");
    break;
  case "errors":
    cmdErrors();
    break;
  case "weak":
    cmdWeak();
    break;
  case "leaderboard":
    cmdLeaderboard();
    break;
  case "tune":
    cmdTune();
    break;
  default:
    console.log("Canavar CLI - Agent Cross-Training System");
    console.log("Komutlar:");
    console.log("  report       - Genel durum raporu");
    console.log("  agent <isim> - Tek agent detay");
    console.log("  errors       - Son 7 gun hatalari");
    console.log("  weak         - En zayif agent'lar");
    console.log("  leaderboard  - Basari siralamas\u0131");
    console.log("  tune         - Agent tuning onerileri");
}
