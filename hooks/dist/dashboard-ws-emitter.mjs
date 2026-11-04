// src/dashboard-ws-emitter.ts
import { readFileSync } from "fs";
import { request } from "node:http";
function extractAgentInfo(input) {
  const ti = input.tool_input || {};
  const response = input.tool_response;
  const object = response && typeof response === "object" ? response : {};
  const hasError = object.is_error === true || object.isError === true || typeof object.exitCode === "number" && object.exitCode !== 0 || typeof object.exit_code === "number" && object.exit_code !== 0;
  if (input.tool_name === "Agent" || input.tool_name === "Task") {
    const agentType = typeof ti.subagent_type === "string" ? ti.subagent_type : typeof ti.type === "string" ? ti.type : "unknown";
    const hasResponse = response !== void 0 && response !== null;
    return {
      type: hasError ? "agent_error" : hasResponse ? "agent_complete" : "agent_spawn",
      agentType: agentType.slice(0, 128),
      status: hasError ? "error" : hasResponse ? "done" : "running",
      metadata: { tool: input.tool_name }
    };
  }
  return {
    type: "tool_call",
    status: hasError ? "error" : "done",
    metadata: { tool: input.tool_name }
  };
}
function sendToWebSocket(event) {
  const port = Number(process.env.VIBECO_DASHBOARD_WS_PORT || 3847);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.resolve();
  return new Promise((resolve) => {
    const payload = JSON.stringify(event);
    const postData = Buffer.from(payload);
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/event",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": postData.length
        },
        timeout: 500
      },
      (response) => {
        response.resume();
        resolve();
      }
    );
    req.on("error", () => resolve());
    req.on("timeout", () => {
      req.destroy();
      resolve();
    });
    req.write(postData);
    req.end();
  });
}
async function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf-8");
  } catch {
    return;
  }
  if (!raw) {
    console.log("{}");
    return;
  }
  let input;
  try {
    input = JSON.parse(raw);
    if (!input || typeof input.tool_name !== "string" || !input.tool_input || typeof input.tool_input !== "object" || Array.isArray(input.tool_input)) {
      console.log("{}");
      return;
    }
  } catch {
    console.log("{}");
    return;
  }
  const interestingTools = ["Agent", "Task", "Bash", "Edit", "Write", "Read", "Grep", "Glob"];
  if (!interestingTools.includes(input.tool_name)) {
    console.log("{}");
    return;
  }
  const partial = extractAgentInfo(input);
  const event = {
    type: partial.type || "tool_call",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: (typeof input.session_id === "string" ? input.session_id : "unknown").slice(0, 128),
    agentType: partial.agentType || void 0,
    agentId: process.env.CLAUDE_AGENT_ID || void 0,
    status: partial.status || "done",
    metadata: partial.metadata || {}
  };
  await sendToWebSocket(event);
  console.log("{}");
}
main();
export {
  extractAgentInfo
};
