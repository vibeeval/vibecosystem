/**
 * vibecosystem Dashboard Server
 * - WebSocket server (port 3847): Event broadcast + hook event alimi
 * - HTTP server (port 3848): Dashboard UI serve + REST API
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
let WebSocketServer;
try { ({ WebSocketServer } = require('ws')); } catch {
  console.error(`[vibecosystem] Dashboard dependency missing. Run: npm ci --ignore-scripts --prefix ${JSON.stringify(__dirname)}`);
  process.exit(1);
}

const WS_PORT = Number(process.env.VIBECO_DASHBOARD_WS_PORT || 3847);
const HTTP_PORT = Number(process.env.VIBECO_DASHBOARD_HTTP_PORT || 3848);
if (![WS_PORT, HTTP_PORT].every(port => Number.isInteger(port) && port > 0 && port <= 65535)) {
  throw new Error('Dashboard ports must be integers between 1 and 65535');
}
const CANAVAR_DIR = path.join(require('os').homedir(), '.claude', 'canavar');
const EVENTS_LOG = path.join(require('os').homedir(), '.claude', 'agent-events.jsonl');
const LEDGER_PATH = path.join(CANAVAR_DIR, 'error-ledger.jsonl');
const MATRIX_PATH = path.join(CANAVAR_DIR, 'skill-matrix.json');
const TOKEN_LOG = path.join(require('os').homedir(), '.claude', 'token-usage.jsonl');

// In-memory event store (son 1000 event)
const eventStore = [];
const MAX_EVENTS = 1000;

// Session stats
const sessionStats = {
  startTime: new Date().toISOString(),
  totalEvents: 0,
  agentSpawns: 0,
  agentCompletes: 0,
  agentErrors: 0,
  toolCalls: 0,
  hookFires: 0,
  agentDurations: [],
  byAgentType: Object.create(null),
};

function addEvent(event) {
  eventStore.push(event);
  if (eventStore.length > MAX_EVENTS) {
    eventStore.shift();
  }

  sessionStats.totalEvents++;

  switch (event.type) {
    case 'agent_spawn':
      sessionStats.agentSpawns++;
      break;
    case 'agent_complete':
      sessionStats.agentCompletes++;
      break;
    case 'agent_error':
      sessionStats.agentErrors++;
      break;
    case 'tool_call':
      sessionStats.toolCalls++;
      break;
    case 'hook_fire':
      sessionStats.hookFires++;
      break;
  }

  if (event.agentType && (Object.hasOwn(sessionStats.byAgentType, event.agentType) ||
      Object.keys(sessionStats.byAgentType).length < 256)) {
    if (!sessionStats.byAgentType[event.agentType]) {
      sessionStats.byAgentType[event.agentType] = {
        spawns: 0,
        completes: 0,
        errors: 0,
        totalDuration: 0,
      };
    }
    const agentStats = sessionStats.byAgentType[event.agentType];
    if (event.type === 'agent_spawn') agentStats.spawns++;
    if (event.type === 'agent_complete') agentStats.completes++;
    if (event.type === 'agent_error') agentStats.errors++;
    if (event.duration) {
      agentStats.totalDuration += event.duration;
      sessionStats.agentDurations.push(event.duration);
      if (sessionStats.agentDurations.length > 5000) {
        sessionStats.agentDurations = sessionStats.agentDurations.slice(-2500);
      }
    }
  }
}

function loadCanavarErrors() {
  try {
    if (!fs.existsSync(LEDGER_PATH)) return [];
    const lines = fs.readFileSync(LEDGER_PATH, 'utf-8').split('\n').filter(l => l.trim());
    const errors = [];
    for (const line of lines) {
      try { errors.push(JSON.parse(line)); } catch { /* skip */ }
    }
    // Son 50 hata
    return errors.slice(-50).reverse();
  } catch {
    return [];
  }
}

function loadSkillMatrix() {
  try {
    if (!fs.existsSync(MATRIX_PATH)) return { agents: {} };
    return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf-8'));
  } catch {
    return { agents: {} };
  }
}

function loadRecentAgentEvents(limit = 100) {
  try {
    if (!fs.existsSync(EVENTS_LOG)) return [];
    const content = fs.readFileSync(EVENTS_LOG, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const events = [];
    for (const line of lines.slice(-limit)) {
      try { events.push(JSON.parse(line)); } catch { /* skip */ }
    }
    return events.reverse();
  } catch {
    return [];
  }
}

function loadTokenUsage(limit = 200) {
  try {
    if (!fs.existsSync(TOKEN_LOG)) return { entries: [], summary: { total: 0, byTool: {}, byAgent: {}, sources: {} } };
    const lines = fs.readFileSync(TOKEN_LOG, 'utf-8').split('\n').filter(l => l.trim());
    const entries = [];
    const byTool = {};
    const byAgent = {};
    const sources = {};
    let total = 0;

    for (const line of lines.slice(-limit)) {
      try {
        const entry = JSON.parse(line);
        const legacyChars = Number(entry.total_chars);
        const totalTokens = Number.isFinite(Number(entry.total_tokens_est))
          ? Number(entry.total_tokens_est)
          : Number.isFinite(Number(entry.total_est))
            ? Number(entry.total_est)
            : Number.isFinite(legacyChars)
              ? Math.ceil(legacyChars / 4)
              : 0;
        const source = entry.token_source || (entry.total_est != null ? 'legacy-estimate' : 'legacy-chars-estimate');
        const normalized = { ...entry, total_tokens_est: totalTokens, token_source: source };
        entries.push(normalized);
        total += totalTokens;
        byTool[entry.tool] = (byTool[entry.tool] || 0) + totalTokens;
        if (entry.agent) {
          byAgent[entry.agent] = (byAgent[entry.agent] || 0) + totalTokens;
        }
        sources[source] = (sources[source] || 0) + 1;
      } catch { /* skip */ }
    }

    return { entries: entries.slice(-50).reverse(), summary: { total, byTool, byAgent, sources } };
  } catch {
    return { entries: [], summary: { total: 0, byTool: {}, byAgent: {}, sources: {} } };
  }
}

function estimateCosts() {
  // Rough cost estimates per 1K tokens (USD)
  const COSTS = {
    haiku: { input: 0.00025, output: 0.00125 },
    sonnet: { input: 0.003, output: 0.015 },
    opus: { input: 0.015, output: 0.075 },
  };

  const usage = loadTokenUsage(1000);
  const totalTokens = usage.summary.total;

  return {
    totalTokens,
    estimatedCost: {
      asHaiku: ((totalTokens / 1000) * COSTS.haiku.output).toFixed(4),
      asSonnet: ((totalTokens / 1000) * COSTS.sonnet.output).toFixed(4),
      asOpus: ((totalTokens / 1000) * COSTS.opus.output).toFixed(4),
    },
    byTool: usage.summary.byTool,
    byAgent: usage.summary.byAgent,
  };
}

function getStats() {
  const avgDuration = sessionStats.agentDurations.length > 0
    ? sessionStats.agentDurations.reduce((a, b) => a + b, 0) / sessionStats.agentDurations.length
    : 0;

  const errorRate = sessionStats.agentSpawns > 0
    ? ((sessionStats.agentErrors / sessionStats.agentSpawns) * 100).toFixed(1)
    : '0.0';

  return {
    ...sessionStats,
    avgDuration: Math.round(avgDuration),
    errorRate,
    uptime: Math.round((Date.now() - new Date(sessionStats.startTime).getTime()) / 1000),
  };
}

// Both listeners bind loopback. Host validation also prevents DNS rebinding;
// WebSocket upgrades need their own Origin check (HTTP CORS does not cover them).
const allowedOrigins = new Set([
  `http://127.0.0.1:${HTTP_PORT}`, `http://localhost:${HTTP_PORT}`,
]);
function hasLocalHost(req, port) {
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`]).has(req.headers.host);
}
function reject(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}
const eventTypes = new Set(['agent_spawn', 'agent_complete', 'agent_error', 'hook_fire', 'tool_call']);
function validEvent(event) {
  return event && typeof event === 'object' && !Array.isArray(event) &&
    eventTypes.has(event.type) && typeof event.timestamp === 'string' &&
    event.timestamp.length <= 64 && Number.isFinite(Date.parse(event.timestamp)) &&
    typeof event.sessionId === 'string' && event.sessionId.length <= 128 &&
    ['running', 'done', 'error'].includes(event.status) &&
    (event.agentType == null || typeof event.agentType === 'string' && event.agentType.length <= 128) &&
    (event.duration == null || typeof event.duration === 'number' && Number.isFinite(event.duration) && event.duration >= 0) &&
    (event.metadata == null || typeof event.metadata === 'object' && !Array.isArray(event.metadata));
}

const wsHttpServer = http.createServer((req, res) => {
  if (!hasLocalHost(req, WS_PORT) || req.headers.origin) {
    reject(res, 403, 'forbidden'); return;
  }
  if (req.method !== 'POST' || req.url !== '/event') {
    reject(res, 404, 'not found'); return;
  }
  let body = '';
  let bodySize = 0;
  let tooLarge = false;
  const MAX_BODY = 64 * 1024;
  req.on('data', chunk => {
    if (tooLarge) return;
    bodySize += chunk.length;
    if (bodySize > MAX_BODY) {
      tooLarge = true;
      reject(res, 413, 'payload too large');
      return;
    }
    body += chunk;
  });
  req.on('end', () => {
    if (tooLarge) return;
    let event;
    try { event = JSON.parse(body); } catch { reject(res, 400, 'invalid json'); return; }
    if (!validEvent(event)) { reject(res, 400, 'invalid event'); return; }
    addEvent(event);
    const payload = JSON.stringify(event);
    wss.clients.forEach(client => {
      if (client.readyState === 1) client.send(payload);
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
  req.on('error', () => { if (!res.headersSent) reject(res, 400, 'invalid request'); });
});
wsHttpServer.requestTimeout = 5000;
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
wsHttpServer.on('upgrade', (req, socket, head) => {
  if (req.url !== '/' || !hasLocalHost(req, WS_PORT) || !allowedOrigins.has(req.headers.origin)) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  console.log(`[WS] Client connected (total: ${wss.clients.size})`);

  // Baglanan client'a mevcut event'leri gonder
  ws.send(JSON.stringify({
    type: 'init',
    timestamp: new Date().toISOString(),
    events: eventStore.slice(-50),
    stats: getStats(),
  }));

  ws.on('close', () => {
    console.log(`[WS] Client disconnected (total: ${wss.clients.size})`);
  });
});

wsHttpServer.listen(WS_PORT, '127.0.0.1', () => {
  console.log(`[WS] WebSocket + Event receiver on ws://127.0.0.1:${WS_PORT}`);
});

// === HTTP Server (port 3848) ===
const httpServer = http.createServer((req, res) => {
  if (!hasLocalHost(req, HTTP_PORT) || (req.headers.origin && !allowedOrigins.has(req.headers.origin))) {
    reject(res, 403, 'forbidden'); return;
  }
  if (!['GET', 'OPTIONS'].includes(req.method)) { reject(res, 405, 'method not allowed'); return; }
  // No cross-origin access is needed by the dashboard.
  if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:${WS_PORT} ws://localhost:${WS_PORT}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // REST API
  if (req.url === '/api/errors') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadCanavarErrors()));
    return;
  }

  if (req.url === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStats()));
    return;
  }

  if (req.url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(eventStore.slice(-100)));
    return;
  }

  if (req.url === '/api/matrix') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadSkillMatrix()));
    return;
  }

  if (req.url === '/api/agent-events') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadRecentAgentEvents()));
    return;
  }

  if (req.url === '/api/tokens') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadTokenUsage()));
    return;
  }

  if (req.url === '/api/costs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(estimateCosts()));
    return;
  }

  if (req.url === '/dashboard.css') {
    try {
      const css = fs.readFileSync(path.join(__dirname, 'dashboard.css'));
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(css);
    } catch { reject(res, 500, 'dashboard.css not found'); }
    return;
  }

  // Static files
  if (req.url === '/' || req.url === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf-8').replace('__VIBECO_WS_PORT__', String(WS_PORT));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end('index.html not found');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`[HTTP] Dashboard UI on http://127.0.0.1:${HTTP_PORT}`);
  console.log(`[vibecosystem] Agent Monitoring Dashboard ready`);
});

for (const server of [wsHttpServer, httpServer]) {
  server.on('error', error => {
    console.error(`[vibecosystem] Dashboard failed: ${error.message}`);
    process.exit(1);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[vibecosystem] Shutting down...');
  wss.close();
  wsHttpServer.close();
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  wss.close();
  wsHttpServer.close();
  httpServer.close();
  process.exit(0);
});
