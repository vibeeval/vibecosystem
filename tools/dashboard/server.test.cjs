const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const http = require('node:http');
const net = require('node:net');
const WebSocket = require('ws');
let child, home, httpPort, wsPort;
const sockets = new Set();
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function request(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve({ status: response.statusCode, data }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
function connect({ origin = `http://127.0.0.1:${httpPort}`, host } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}`, { origin, headers: host ? { Host: host } : {} });
    sockets.add(ws);
    ws.once('error', reject);
    ws.once('unexpected-response', (_, response) => {
      response.resume();
      resolve({ status: response.statusCode });
    });
    ws.once('message', data => resolve({ status: 101, ws, init: JSON.parse(data) }));
  });
}
before(async () => {
  home = mkdtempSync(join(tmpdir(), 'vibeco-dashboard-test-'));
  httpPort = await freePort();
  do { wsPort = await freePort(); } while (wsPort === httpPort);
  child = spawn(process.execPath, [join(__dirname, 'server.js')], {
    env: { ...process.env, HOME: home, VIBECO_DASHBOARD_HTTP_PORT: String(httpPort), VIBECO_DASHBOARD_WS_PORT: String(wsPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dashboard startup timeout')), 5000);
    let output = '';
    child.on('error', reject);
    child.on('exit', code => reject(new Error(`dashboard exited ${code}: ${output}`)));
    child.stderr.on('data', data => output += data);
    child.stdout.on('data', data => {
      output += data;
      if (output.includes('Dashboard ready')) { clearTimeout(timer); resolve(); }
    });
  });
});
after(async () => {
  for (const ws of sockets) ws.terminate();
  if (child && child.exitCode == null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    await exited;
  }
  if (home) rmSync(home, { recursive: true, force: true });
});
test('serves local UI and APIs but denies rebinding hosts and cross-origin requests', async () => {
  const page = await request(httpPort, '/');
  assert.equal(page.status, 200);
  assert.equal(/https?:\/\/(?:cdn|fonts)\./.test(page.data), false);
  assert.ok(page.data.includes(`Number('${wsPort}')`));
  const css = await request(httpPort, '/dashboard.css');
  assert.equal(css.status, 200);
  assert.ok(css.data.includes('.bg-vibe-card'));
  assert.equal((await request(httpPort, '/api/stats')).status, 200);
  assert.equal((await request(httpPort, '/api/stats', { headers: { Host: `attacker.test:${httpPort}` } })).status, 403);
  assert.equal((await request(httpPort, '/api/stats', { headers: { Origin: 'https://attacker.test' } })).status, 403);
  assert.equal((await request(httpPort, '/api/stats', { method: 'POST' })).status, 405);
});
test('rejects cross-origin, absent-origin, rebinding and wrong-port WebSocket upgrades', async () => {
  assert.equal((await connect({ origin: 'https://attacker.test' })).status, 403);
  assert.equal((await connect({ origin: '' })).status, 403);
  assert.equal((await connect({ host: `attacker.test:${wsPort}` })).status, 403);
  assert.equal((await connect({ origin: `http://127.0.0.1:${wsPort}` })).status, 403);
});
test('accepts the dashboard origin and broadcasts validated local events', async () => {
  const { status, ws, init } = await connect();
  assert.equal(status, 101);
  assert.equal(init.type, 'init');
  const event = { type: 'tool_call', timestamp: new Date().toISOString(), sessionId: 'test', status: 'done', metadata: { tool: 'Read' } };
  const message = new Promise(resolve => ws.once('message', data => resolve(JSON.parse(data))));
  assert.equal((await request(wsPort, '/event', { method: 'POST', body: JSON.stringify(event) })).status, 200);
  assert.deepEqual(await message, event);
});
test('validates payloads and keeps serving after oversized input', async () => {
  for (const body of ['null', '[]', '{}', 'invalid json']) {
    assert.equal((await request(wsPort, '/event', { method: 'POST', body })).status, 400);
  }
  assert.equal((await request(wsPort, '/event', { method: 'POST', headers: { Origin: `http://127.0.0.1:${httpPort}` }, body: '{}' })).status, 403);
  assert.equal((await request(wsPort, '/event', { method: 'POST', body: 'x'.repeat(65537) })).status, 413);
  assert.equal((await request(httpPort, '/api/stats')).status, 200);
});

test('distributed ESM emitter reaches the dashboard without copying tool inputs', async () => {
  const bundle = join(__dirname, '../../hooks/dist/dashboard-ws-emitter.mjs');
  const result = spawnSync(process.execPath, [bundle], {
    input: JSON.stringify({ session_id: 'emitter-integration-test', tool_name: 'Bash',
      tool_input: { command: 'fixture-private-input' }, tool_response: { exitCode: 0, stdout: 'fixture-private-output' } }),
    encoding: 'utf8', timeout: 3000,
    env: { ...process.env, HOME: home, VIBECO_DASHBOARD_WS_PORT: String(wsPort) },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {});
  const events = JSON.parse((await request(httpPort, '/api/events')).data);
  const event = events.find(entry => entry.sessionId === 'emitter-integration-test');
  assert.ok(event, 'the distributed hook must actually deliver an event');
  assert.deepEqual(event.metadata, { tool: 'Bash' });
  assert.equal(JSON.stringify(event).includes('fixture-private-'), false);
});
