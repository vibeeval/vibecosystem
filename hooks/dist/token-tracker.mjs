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

// src/token-tracker.ts
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
function charCount(text) {
  if (!text) return 0;
  return String(text).length;
}
function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}
function getUsage(event) {
  return event.usage || event.token_usage || event.metadata?.usage;
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
  const claudeDir = join(homedir(), ".claude");
  const logFile = join(claudeDir, "token-usage.jsonl");
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
  const inputChars = charCount(JSON.stringify(event.tool_input || {}));
  const outputChars = charCount(hookResponseText(event));
  const usage = getUsage(event);
  const providerInput = Number(usage?.input_tokens);
  const providerOutput = Number(usage?.output_tokens);
  const providerTotal = Number(usage?.total_tokens);
  const hasProviderInput = typeof usage?.input_tokens === "number" && Number.isFinite(providerInput) && providerInput >= 0;
  const hasProviderOutput = typeof usage?.output_tokens === "number" && Number.isFinite(providerOutput) && providerOutput >= 0;
  const hasProviderTotal = typeof usage?.total_tokens === "number" && Number.isFinite(providerTotal) && providerTotal >= 0;
  const inputTokens = hasProviderInput ? providerInput : estimateTokens(inputChars);
  const outputTokens = hasProviderOutput ? providerOutput : estimateTokens(outputChars);
  const totalTokens = hasProviderTotal ? providerTotal : inputTokens + outputTokens;
  const inputSource = hasProviderInput ? "provider" : "estimate";
  const outputSource = hasProviderOutput ? "provider" : "estimate";
  const totalSource = hasProviderTotal ? "provider" : inputSource === "estimate" && outputSource === "estimate" ? "estimate" : "mixed";
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    session_id: event.session_id || "unknown",
    tool: event.tool_name,
    input_chars: inputChars,
    output_chars: outputChars,
    total_chars: inputChars + outputChars,
    input_tokens_est: inputTokens,
    output_tokens_est: outputTokens,
    total_tokens_est: totalTokens,
    token_source: totalSource,
    input_token_source: inputSource,
    output_token_source: outputSource,
    total_token_source: totalSource
  };
  if (event.tool_name === "Agent" && event.tool_input) {
    entry.agent = String(event.tool_input.subagent_type || "general-purpose");
  }
  try {
    appendFileSync(logFile, JSON.stringify(entry) + "\n");
  } catch {
  }
}
try {
  runHook();
} catch {
  process.exit(0);
}
