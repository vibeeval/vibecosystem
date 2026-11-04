const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Exercise the actual inline dashboard code without opening a browser or running
// the live initialization. The fixtures contain harmless markup, never scripts.
function dashboardUI(ledger = []) {
  const elements = new Map();
  const context = vm.createContext({
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '' });
      return elements.get(id);
    } },
    fetch: async () => ({ json: async () => ledger }),
  });
  const html = readFileSync(join(__dirname, 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script.slice(0, script.indexOf('// === Init ===')), context);
  return { context, elements };
}

test('error ledger fields render as escaped text, including agent type', async () => {
  const marker = '<em data-review="fixture">agent</em>';
  const { context, elements } = dashboardUI([
    { agent_type: marker, error_pattern: '<b>detail</b>', lesson: '<i>lesson</i>', ts: '<u>time</u>' },
    { agent_type: 42, detail: { toString: 'not a function' }, lesson: ['scalar', 1] },
    null,
  ]);
  await context.fetchErrors();
  const output = elements.get('error-container').innerHTML;
  assert.equal(output.includes(marker), false);
  assert.ok(output.includes('&lt;em data-review=&quot;fixture&quot;&gt;agent&lt;/em&gt;'));
  assert.ok(output.includes('&lt;b&gt;detail&lt;/b&gt;'));
  assert.ok(output.includes('&lt;i&gt;lesson&lt;/i&gt;'));
  assert.ok(output.includes('42'));
  assert.equal(output.includes('Dashboard server not running'), false);
});

test('prototype property names are valid timeline agents and completion-only events render', () => {
  const { context, elements } = dashboardUI();
  for (const agentType of ['constructor', '__proto__', 'toString']) {
    const event = { agentType, type: 'agent_spawn', timestamp: new Date().toISOString(), metadata: {} };
    context.updateTimeline(event);
    context.updateTimeline({ ...event, type: 'agent_complete' });
  }
  context.updateTimeline({ agentType: 'completion-only', type: 'agent_complete', timestamp: new Date().toISOString(), metadata: {} });
  context.updateAgentBreakdown();
  const state = JSON.parse(vm.runInContext('JSON.stringify(agentTimelines)', context));
  assert.deepEqual(Object.keys(state), ['constructor', '__proto__', 'toString', 'completion-only']);
  assert.equal(state.constructor[0].status, 'done');
  assert.equal(state['completion-only'][0].inferredStart, true);
  assert.ok(elements.get('timeline-container').innerHTML.includes('completed'));
  assert.ok(elements.get('agent-breakdown').innerHTML.includes('constructor'));
});

test('structured metadata and non-string ledger scalars cannot crash text formatting', () => {
  const { context } = dashboardUI();
  assert.equal(context.formatEventDetail({ metadata: { tool: 'Read', detail: {} } }), 'Read: {}');
  assert.equal(context.formatEventDetail({ metadata: { command: 42 } }), '42');
  assert.equal(context.escapeHtml(false), 'false');
  assert.equal(context.escapeHtml(0), '0');
  assert.equal(context.escapeHtml(null), '');
  assert.equal(context.escapeHtml({ toString: 'not a function' }), '{&quot;toString&quot;:&quot;not a function&quot;}');
});
