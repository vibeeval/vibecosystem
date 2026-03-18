// src/agent-tuner.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
function main() {
  const canavarDir = join(homedir(), ".claude", "canavar");
  const matrixPath = join(canavarDir, "skill-matrix.json");
  const cacheDir = join(homedir(), ".claude", "cache");
  const outputPath = join(cacheDir, "tuning-recommendations.json");
  if (!existsSync(matrixPath)) {
    console.log("skill-matrix.json bulunamadi. Once birkac session calistirin.");
    return;
  }
  const matrix = JSON.parse(readFileSync(matrixPath, "utf-8"));
  const recommendations = [];
  for (const [agentName, profile] of Object.entries(matrix.agents)) {
    if (profile.total_tasks < 2) continue;
    if (profile.success_rate < 0.5) {
      recommendations.push({
        agent: agentName,
        action: "retrain",
        reason: `Basari orani cok dusuk: %${(profile.success_rate * 100).toFixed(0)}`,
        details: `${profile.failures}/${profile.total_tasks} gorevde hata. Sik hatalar: ${profile.common_errors.join(", ") || "yok"}`,
        priority: "high"
      });
    }
    const skills = Object.entries(profile.skills).filter(([, s]) => s.attempts >= 2);
    if (skills.length >= 2) {
      const highSkills = skills.filter(([, s]) => s.rate >= 0.8);
      const lowSkills = skills.filter(([, s]) => s.rate < 0.5);
      if (highSkills.length > 0 && lowSkills.length > 0) {
        recommendations.push({
          agent: agentName,
          action: "specialize",
          reason: `Bazi skill'lerde iyi, bazilarinda zayif`,
          details: `Guclu: ${highSkills.map(([s, st]) => `${s}(%${(st.rate * 100).toFixed(0)})`).join(", ")}. Zayif: ${lowSkills.map(([s, st]) => `${s}(%${(st.rate * 100).toFixed(0)})`).join(", ")}`,
          priority: "medium"
        });
      }
    }
    if (profile.success_rate >= 0.9 && profile.total_tasks >= 5) {
      recommendations.push({
        agent: agentName,
        action: "promote",
        reason: `Mukemmel performans: %${(profile.success_rate * 100).toFixed(0)} basari`,
        details: `${profile.successes}/${profile.total_tasks} gorev basarili. Guclu skill'ler: ${Object.entries(profile.skills).filter(([, s]) => s.rate >= 0.8).map(([s]) => s).join(", ") || "genel"}`,
        priority: "low"
      });
    }
  }
  const thirtyDaysAgo = /* @__PURE__ */ new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  for (const [agentName, profile] of Object.entries(matrix.agents)) {
    if (profile.last_active && new Date(profile.last_active) < thirtyDaysAgo) {
      recommendations.push({
        agent: agentName,
        action: "reassign",
        reason: `30+ gundur aktif degil`,
        details: `Son aktif: ${profile.last_active}. Toplam gorev: ${profile.total_tasks}`,
        priority: "low"
      });
    }
  }
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const report = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    total_agents: Object.keys(matrix.agents).length,
    recommendations,
    summary: {
      retrain: recommendations.filter((r) => r.action === "retrain").length,
      specialize: recommendations.filter((r) => r.action === "specialize").length,
      reassign: recommendations.filter((r) => r.action === "reassign").length,
      promote: recommendations.filter((r) => r.action === "promote").length
    }
  };
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`=== AGENT TUNING RAPORU ===
`);
  console.log(`Toplam agent: ${report.total_agents}`);
  console.log(`Oneri sayisi: ${recommendations.length}`);
  console.log(`  Retrain: ${report.summary.retrain} | Specialize: ${report.summary.specialize} | Reassign: ${report.summary.reassign} | Promote: ${report.summary.promote}
`);
  if (recommendations.length === 0) {
    console.log("Hicbir oneri yok - tum agent'lar iyi durumda.");
    return;
  }
  for (const rec of recommendations) {
    const icon = rec.action === "retrain" ? "[!]" : rec.action === "specialize" ? "[~]" : rec.action === "reassign" ? "[-]" : "[+]";
    console.log(`${icon} ${rec.agent} \u2192 ${rec.action.toUpperCase()}`);
    console.log(`   ${rec.reason}`);
    console.log(`   ${rec.details}
`);
  }
}
main();
