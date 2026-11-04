/**
 * Canavar Subagent Tracker - PostToolUse:Agent hook
 *
 * Her subagent tamamlandığında skill-matrix.json'ı anında günceller.
 * Canavar-skill-tracker sadece Stop'ta çalışır; bu hook realtime takip sağlar.
 *
 * Kayıt ettiği bilgiler:
 * - Subagent türü ve görevi
 * - Başarı/başarısızlık sinyali
 * - Son aktif zaman
 * - Çalıştığı dosya türleri (skill kategorisi)
 */
import { hookResponseText } from './shared/hook-response.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface PostAgentInput {
  session_id: string;
  tool_name: string;
  tool_input: {
    subagent_type?: string;
    description?: string;
    prompt?: string;
  };
  tool_output?: string;
  tool_response?: unknown;
}

interface SkillStats {
  attempts: number;
  successes: number;
  rate: number;
}

interface AgentProfile {
  total_tasks: number;
  successes: number;
  failures: number;
  success_rate: number;
  skills: Record<string, SkillStats>;
  common_errors: string[];
  last_active: string;
  comms?: {
    messages_sent: number;
    messages_received: number;
    broadcasts: number;
    avg_response_time_ms: number;
  };
}

interface SkillMatrix {
  agents: Record<string, AgentProfile>;
  updated_at: string;
}

// Görev açıklamasından veya çıktıdan skill kategorisi çıkar
function inferSkillFromContext(description: string, output: string): string | null {
  const text = (description + ' ' + output).toLowerCase();

  if (/\.(ts|tsx|js|jsx|mjs|cjs)/.test(text) || /typescript|javascript|react|next\.js/.test(text)) return 'typescript';
  if (/\.(py|pyi)/.test(text) || /python|django|fastapi|pytest/.test(text)) return 'python';
  if (/\.(go)/.test(text) || /golang|go build|go test/.test(text)) return 'go';
  if (/\.(sql)/.test(text) || /database|postgres|mysql|query|migration/.test(text)) return 'database';
  if (/\.(ya?ml|dockerfile|\.github)/.test(text) || /docker|kubernetes|ci\/cd|github action/.test(text)) return 'devops';
  if (/\.(test|spec)\./.test(text) || /unit test|integration test|e2e|vitest|jest/.test(text)) return 'testing';
  if (/\.(md|txt|rst)/.test(text) || /documentation|readme|docs/.test(text)) return 'documentation';
  if (/\.(css|scss|less|styled)/.test(text) || /styling|tailwind|css/.test(text)) return 'styling';
  if (/security|auth|jwt|xss|injection|csrf/.test(text)) return 'security';
  if (/performance|optimize|bottleneck|profil/.test(text)) return 'performance';

  return null;
}

// Çıktıdan başarı/başarısızlık sinyali belirle
function detectOutcome(output: string): 'success' | 'failure' | 'unknown' {
  if (!output || output.length < 5) return 'unknown';

  const text = output.toLowerCase();

  // Açık başarı sinyalleri
  const successSignals = [
    /all\s+\d+\s+tests?\s+pass/i,
    /\bsuccess(fully)?\b/i,
    /\bcompleted?\b/i,
    /\bverified\b/i,
    /\bdone\b.*\bno\s+error/i,
    /build\s+successful/i,
    /\d+\s+passed/i,
  ];

  // Açık hata sinyalleri
  const failureSignals = [
    /\berror\b.*\bfailed?\b/i,
    /\bfailed?\s+to\b/i,
    /\bexception\b/i,
    /\bcrash(ed)?\b/i,
    /\d+\s+failed/i,
    /build\s+fail/i,
    /cannot\s+(find|resolve|read)/i,
  ];

  let successCount = 0;
  let failureCount = 0;

  for (const sig of successSignals) {
    if (sig.test(text)) successCount++;
  }
  for (const sig of failureSignals) {
    if (sig.test(text)) failureCount++;
  }

  if (failureCount > successCount) return 'failure';
  if (successCount > 0) return 'success';

  // Genel "error" veya "fail" kelimesi var mı?
  if (/\berror\b|\bfail(ed|ure)?\b/.test(text)) return 'failure';

  return 'unknown';
}

function loadMatrix(matrixPath: string): SkillMatrix {
  if (!existsSync(matrixPath)) return { agents: {}, updated_at: '' };
  try {
    return JSON.parse(readFileSync(matrixPath, 'utf-8'));
  } catch {
    return { agents: {}, updated_at: '' };
  }
}

function ensureProfile(matrix: SkillMatrix, agentType: string): AgentProfile {
  if (!matrix.agents[agentType]) {
    matrix.agents[agentType] = {
      total_tasks: 0,
      successes: 0,
      failures: 0,
      success_rate: 0,
      skills: {},
      common_errors: [],
      last_active: '',
    };
  }
  return matrix.agents[agentType];
}

function main() {
  let raw = '';
  try { raw = readFileSync(0, 'utf-8'); } catch { return; }
  if (!raw) { console.log('{}'); return; }

  let input: PostAgentInput;
  try { input = JSON.parse(raw); } catch { console.log('{}'); return; }

  // Sadece Agent tool sonuçlarını işle
  if (input.tool_name !== 'Agent') {
    console.log('{}');
    return;
  }

  const agentType = input.tool_input?.subagent_type || 'unknown-agent';
  const description = input.tool_input?.description || '';
  const output = hookResponseText(input);

  // Çok kısa veya anlamsız agent çağrılarını atla
  if (agentType === 'unknown-agent' && !description) {
    console.log('{}');
    return;
  }

  const canavarDir = join(homedir(), '.claude', 'canavar');
  if (!existsSync(canavarDir)) mkdirSync(canavarDir, { recursive: true });

  const matrixPath = join(canavarDir, 'skill-matrix.json');

  // Matrix'i oku
  const matrix = loadMatrix(matrixPath);
  const profile = ensureProfile(matrix, agentType);

  profile.last_active = new Date().toISOString();

  // Başarı/başarısızlık belirle - sadece kesin sinyallerde say
  const outcome = detectOutcome(output);
  if (outcome === 'success') {
    profile.total_tasks++;
    profile.successes++;
  } else if (outcome === 'failure') {
    profile.total_tasks++;
    profile.failures++;
  }
  // unknown = ne success ne failure, total_tasks artırma

  // Başarı oranını güncelle
  profile.success_rate = profile.total_tasks > 0
    ? Number((profile.successes / profile.total_tasks).toFixed(2))
    : 0;

  // Skill kategorisini güncelle
  const skill = inferSkillFromContext(description, output);
  if (skill) {
    if (!profile.skills[skill]) {
      profile.skills[skill] = { attempts: 0, successes: 0, rate: 0 };
    }
    const skillStats = profile.skills[skill];
    skillStats.attempts++;
    if (outcome !== 'failure') {
      skillStats.successes++;
    }
    skillStats.rate = skillStats.attempts > 0
      ? Number((skillStats.successes / skillStats.attempts).toFixed(2))
      : 1;
  }

  matrix.updated_at = new Date().toISOString();

  // Dogrudan yaz (Stop hook'ta skill-tracker zaten backup yapar)
  try {
    writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));
  } catch {
    // Yazma hatasi kritik degil, session sonunda canavar-skill-tracker tekrar yazacak
  }

  console.log(JSON.stringify({
    result: `Canavar: ${agentType} → ${outcome} (toplam: ${profile.total_tasks}, oran: %${Math.round(profile.success_rate * 100)})`,
  }));
}

main();
