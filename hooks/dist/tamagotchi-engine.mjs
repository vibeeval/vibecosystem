// src/shared/hook-response.ts
function responseText(value) {
  if (value === void 0 || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(responseText).filter(Boolean).join("\n");
  if (typeof value !== "object") return String(value);
  const object = value;
  if ("stdout" in object || "stderr" in object) {
    return [object.stdout, object.stderr].map(responseText).filter(Boolean).join("\n");
  }
  if ("text" in object) return responseText(object.text);
  if ("content" in object) return responseText(object.content);
  if ("file" in object) return responseText(object.file);
  if (object.type === "image" || object.type === "image_url") return "";
  return JSON.stringify(value);
}
function hookResponseText(input) {
  return responseText(input.tool_response !== void 0 ? input.tool_response : input.tool_output);
}

// src/tamagotchi-engine.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, userInfo } from "node:os";
import { createHash } from "node:crypto";
var SPECIES = [
  { name: "axolotl", emoji: ":3" },
  { name: "capybara", emoji: "(ovo)" },
  { name: "ghost", emoji: "[@@]" },
  { name: "mushroom", emoji: "{^o^}" },
  { name: "robot", emoji: "[0_0]" },
  { name: "cat", emoji: "(=^.^=)" },
  { name: "dragon", emoji: "<{:O>" },
  { name: "owl", emoji: "(O.O)" },
  { name: "fox", emoji: "(^v^)" },
  { name: "penguin", emoji: "(^-^)/" },
  { name: "slime", emoji: "(~o~)" },
  { name: "phoenix", emoji: "<*v*>" }
];
var STATE_PATH = join(homedir(), ".claude", "tamagotchi.json");
function getSpecies() {
  const username = userInfo().username || "default";
  const hash = createHash("md5").update(username).digest("hex");
  const index = parseInt(hash.slice(0, 8), 16) % SPECIES.length;
  return SPECIES[index];
}
function loadState() {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
    } catch {
    }
  }
  const species = getSpecies();
  return {
    species: species.name,
    emoji: species.emoji,
    level: 1,
    mood: "happy",
    stats: { debugging: 50, patience: 50, chaos: 30, wisdom: 40, speed: 50 },
    lastFed: (/* @__PURE__ */ new Date()).toISOString(),
    totalSessions: 0,
    sessionEvents: 0
  };
}
function saveState(state) {
  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
function clamp(val) {
  return Math.max(0, Math.min(100, val));
}
function calculateLevel(state) {
  const xpPath = join(homedir(), ".claude", "achievements.json");
  if (existsSync(xpPath)) {
    try {
      const ach = JSON.parse(readFileSync(xpPath, "utf-8"));
      if (ach.xp >= 1e4) return 50;
      if (ach.xp >= 3e3) return 20;
      if (ach.xp >= 1e3) return 10;
      if (ach.xp >= 500) return 5;
      if (ach.xp >= 300) return 3;
      if (ach.xp >= 100) return 2;
    } catch {
    }
  }
  return Math.max(1, Math.floor(state.sessionEvents / 50));
}
function determineMood(state, event) {
  const output = hookResponseText(event).toLowerCase();
  if (output.includes("error") || output.includes("fail") || output.includes("exception")) {
    return state.mood === "sad" ? "angry" : "sad";
  }
  if (output.includes("pass") || output.includes("success") || output.includes("done")) {
    return "happy";
  }
  if (event.tool_name === "Agent") {
    return "excited";
  }
  if (event.tool_name === "Read" || event.tool_name === "Edit") {
    return "focused";
  }
  return state.mood;
}
function updateStats(state, event) {
  const output = hookResponseText(event).toLowerCase();
  switch (event.tool_name) {
    case "Agent": {
      state.stats.chaos = clamp(state.stats.chaos + 2);
      const agentType = String(event.tool_input?.subagent_type || "");
      if (["architect", "planner", "tech-lead"].includes(agentType)) {
        state.stats.wisdom = clamp(state.stats.wisdom + 3);
      }
      if (["sleuth", "replay"].includes(agentType)) {
        state.stats.debugging = clamp(state.stats.debugging + 3);
      }
      break;
    }
    case "Bash":
      if (output.includes("test") && output.includes("pass")) {
        state.stats.speed = clamp(state.stats.speed + 2);
      }
      if (output.includes("error") || output.includes("fail")) {
        state.stats.debugging = clamp(state.stats.debugging + 1);
        state.stats.patience = clamp(state.stats.patience + 1);
      }
      break;
    case "Edit":
    case "Write":
      state.stats.speed = clamp(state.stats.speed + 1);
      break;
    case "Read":
    case "Grep":
    case "Glob":
      state.stats.patience = clamp(state.stats.patience + 1);
      state.stats.wisdom = clamp(state.stats.wisdom + 1);
      break;
  }
  for (const key of Object.keys(state.stats)) {
    const val = Math.round(state.stats[key]);
    if (val > 55) state.stats[key] = clamp(val - 1);
    else if (val < 45) state.stats[key] = clamp(val + 1);
    else state.stats[key] = val;
  }
}
function runHook() {
  let input;
  try {
    input = readFileSync(0, "utf-8");
  } catch {
    return;
  }
  let event;
  try {
    event = JSON.parse(input);
  } catch {
    return;
  }
  const state = loadState();
  state.sessionEvents++;
  state.lastFed = (/* @__PURE__ */ new Date()).toISOString();
  updateStats(state, event);
  state.mood = determineMood(state, event);
  state.level = calculateLevel(state);
  saveState(state);
  if (state.sessionEvents % 20 === 0) {
    const topStat = Object.entries(state.stats).sort(([, a], [, b]) => b - a)[0];
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `${state.emoji} ${state.species} Lv.${state.level} | ${topStat[0]}:${Math.round(topStat[1])} | mood: ${state.mood}`
      }
    }));
  }
}
try {
  runHook();
} catch {
  process.exit(0);
}
