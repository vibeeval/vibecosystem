var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/plugin-registry.ts
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CLAUDE_HOME = join(homedir(), ".claude");
var CONFIG_FILE = join(CLAUDE_HOME, "plugin-config.json");
function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {
  }
  return { hooks: {}, skills: {} };
}
function saveConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}
function isHookEnabled(hookName) {
  const config = loadConfig();
  const entry = config.hooks[hookName];
  if (!entry) return true;
  return entry.enabled;
}
function isSkillEnabled(skillName) {
  const config = loadConfig();
  const entry = config.skills[skillName];
  if (!entry) return true;
  return entry.enabled;
}
function setHookEnabled(hookName, enabled, reason) {
  const config = loadConfig();
  config.hooks[hookName] = {
    enabled,
    disabledAt: enabled ? void 0 : (/* @__PURE__ */ new Date()).toISOString(),
    reason
  };
  saveConfig(config);
}
function setSkillEnabled(skillName, enabled, reason) {
  const config = loadConfig();
  config.skills[skillName] = {
    enabled,
    disabledAt: enabled ? void 0 : (/* @__PURE__ */ new Date()).toISOString(),
    reason
  };
  saveConfig(config);
}
function listHooks() {
  const distDir = join(CLAUDE_HOME, "hooks", "dist");
  if (!existsSync(distDir)) return [];
  return readdirSync(distDir).filter((f) => f.endsWith(".mjs")).map((f) => f.replace(".mjs", "")).sort();
}
function listSkills() {
  const skillsDir = join(CLAUDE_HOME, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter((f) => {
    try {
      return __require("fs").statSync(join(skillsDir, f)).isDirectory();
    } catch {
      return false;
    }
  }).sort();
}
function runCli() {
  const args = process.argv.slice(2);
  const command = args[0];
  switch (command) {
    case "list": {
      const config = loadConfig();
      const hooks = listHooks();
      console.log(`
=== Hook Registry (${hooks.length} hooks) ===
`);
      for (const hook of hooks) {
        const entry = config.hooks[hook];
        const status = entry && !entry.enabled ? "DISABLED" : "enabled";
        const reason = entry?.reason ? ` (${entry.reason})` : "";
        const marker = status === "DISABLED" ? "x" : "+";
        console.log(`  [${marker}] ${hook}${reason}`);
      }
      break;
    }
    case "enable": {
      const target = args[1];
      if (!target) {
        console.error("Usage: plugin-registry enable <hook-name>");
        process.exit(1);
      }
      setHookEnabled(target, true);
      console.log(`Enabled: ${target}`);
      break;
    }
    case "disable": {
      const target = args[1];
      const reason = args[2] || void 0;
      if (!target) {
        console.error("Usage: plugin-registry disable <hook-name> [reason]");
        process.exit(1);
      }
      setHookEnabled(target, false, reason);
      console.log(`Disabled: ${target}${reason ? ` (${reason})` : ""}`);
      break;
    }
    case "enable-skill": {
      const target = args[1];
      if (!target) {
        console.error("Usage: plugin-registry enable-skill <skill-name>");
        process.exit(1);
      }
      setSkillEnabled(target, true);
      console.log(`Enabled skill: ${target}`);
      break;
    }
    case "disable-skill": {
      const target = args[1];
      const reason = args[2] || void 0;
      if (!target) {
        console.error("Usage: plugin-registry disable-skill <skill-name> [reason]");
        process.exit(1);
      }
      setSkillEnabled(target, false, reason);
      console.log(`Disabled skill: ${target}${reason ? ` (${reason})` : ""}`);
      break;
    }
    case "status": {
      const config = loadConfig();
      const disabledHooks = Object.entries(config.hooks).filter(([, v]) => !v.enabled);
      const disabledSkills = Object.entries(config.skills).filter(([, v]) => !v.enabled);
      const totalHooks = listHooks().length;
      const totalSkills = listSkills().length;
      console.log(`
=== Plugin Registry Status ===`);
      console.log(`Hooks:  ${totalHooks - disabledHooks.length}/${totalHooks} active`);
      console.log(`Skills: ${totalSkills - disabledSkills.length}/${totalSkills} active`);
      if (disabledHooks.length > 0) {
        console.log(`
Disabled hooks:`);
        for (const [name, entry] of disabledHooks) {
          console.log(`  - ${name}${entry.reason ? ` (${entry.reason})` : ""}`);
        }
      }
      if (disabledSkills.length > 0) {
        console.log(`
Disabled skills:`);
        for (const [name, entry] of disabledSkills) {
          console.log(`  - ${name}${entry.reason ? ` (${entry.reason})` : ""}`);
        }
      }
      break;
    }
    default:
      console.log("Usage: plugin-registry <list|enable|disable|enable-skill|disable-skill|status> [name] [reason]");
  }
}
var isCliCall = process.argv.length > 2 && ["list", "enable", "disable", "enable-skill", "disable-skill", "status"].includes(process.argv[2]);
if (isCliCall) {
  runCli();
}
export {
  isHookEnabled,
  isSkillEnabled
};
