import assert from 'node:assert/strict';
import test from 'node:test';
import { u as unwrap } from '../../../plugins.v3/agentmascot/dist/assets/provider-mBbtEwEX.js';
import { moviePilotApiUrl, loadMoviePilotPluginConfig, startAgentMascotPatchEntry, createMoviePilotAgentEntry } from '../../../plugins.v3/agentmascot/dist/assets/agentmascot-loader.js';

const envelope = config => ({ success: true, message: '', data: { config } });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('V3 payload failures are not silently replaced with defaults', () => {
  assert.equal(unwrap(envelope({ mascot: 'kurisu' })).config.mascot, 'kurisu');
  assert.throws(() => unwrap({ success: false, message: 'failed', data: null }), /failed/);
  const native = { data: { example: true }, extra: 1 };
  assert.equal(unwrap(native), native);
});

test('API paths do not inherit the current V3 page route', () => {
  const env = { location: { origin: 'https://mp.test', pathname: '/plugin/app/AgentMascot/main' } };
  assert.equal(moviePilotApiUrl('/api/v1/plugin/AgentMascot/status', env), 'https://mp.test/api/v1/plugin/AgentMascot/status');
  env.document = { querySelector: () => ({ href: 'https://mp.test/mp/' }) };
  assert.equal(moviePilotApiUrl('/api/v1/plugin/AgentMascot/status', env), 'https://mp.test/mp/api/v1/plugin/AgentMascot/status');
});

test('injected client keeps the instance ID and public fallback needs no token', async () => {
  const config = await loadMoviePilotPluginConfig('AgentMascot_clone', { api: { get: async path => {
    assert.equal(path, 'plugin/AgentMascot_clone/status');
    return envelope({ enabled: true, mascot: 'kurisu' });
  } } });
  assert.equal(config.mascot, 'kurisu');
  const env = { location: { origin: 'https://mp.test' } };
  await loadMoviePilotPluginConfig('AgentMascot', { env, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://mp.test/api/v1/plugin/AgentMascot/public_status');
    assert.equal(options.headers, undefined);
    return { ok: true, json: async () => envelope({ enabled: true, mascot: 'kurisu' }) };
  } });
  await assert.rejects(loadMoviePilotPluginConfig('AgentMascot', { api: { get: async () => ({}) } }), /no config/);
});

function fakeEnv() {
  const nodes = new Map();
  const intervals = new Set();
  const listeners = new Set();
  let serial = 0;
  const classes = new Set();
  const native = { classList: { add: x => classes.add(x), remove: x => classes.delete(x) }, contains: () => false };
  let clicks = 0;
  const trigger = { click: () => clicks++ };
  function element() {
    return { style: {}, setAttribute() {}, append() {}, addEventListener() {},
      removeEventListener() {}, remove() { nodes.delete(this.id); } };
  }
  const document = {
    querySelector: selector => selector === '.agent-assistant-fab' ? native : selector === '.agent-assistant-fab__trigger' ? trigger : null,
    querySelectorAll: () => [], getElementById: id => nodes.get(id),
    createElement: element, addEventListener() {}, removeEventListener() {},
    body: { appendChild: e => nodes.set(e.id, e) }, head: { appendChild: e => nodes.set(e.id, e) },
  };
  const env = { document, innerWidth: 1200, innerHeight: 800, location: { origin: 'https://mp.test' },
    performance: { now: () => 10 }, getComputedStyle: () => ({}),
    MutationObserver: class { observe() {} disconnect() {} },
    setInterval: () => { intervals.add(++serial); return serial; }, clearInterval: id => intervals.delete(id),
    setTimeout: () => ++serial, clearTimeout() {}, requestAnimationFrame: () => ++serial, cancelAnimationFrame() {},
    addEventListener: event => listeners.add(event), removeEventListener: event => listeners.delete(event) };
  return { env, nodes, intervals, listeners, classes, clicks: () => clicks };
}

test('global mascot starts once, disables cleanly, and can start again', async () => {
  const f = fakeEnv();
  let enabled = true;
  const options = { api: { get: async () => envelope({ enabled, mascot: 'kurisu', replace_agent_entry: true }) } };
  const first = startAgentMascotPatchEntry(f.env, options);
  await flush();
  assert.ok(f.nodes.has('agentmascot-global-root'));
  assert.ok(f.classes.has('agentmascot-native-hidden'));
  assert.equal(startAgentMascotPatchEntry(f.env, options), first);
  enabled = false;
  await first.sync();
  assert.equal(f.nodes.has('agentmascot-global-root'), false);
  assert.equal(f.classes.size, 0);
  first.stop(); first.stop();
  assert.equal(f.intervals.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.nodes.size, 0);
  enabled = true;
  const next = startAgentMascotPatchEntry(f.env, options);
  await flush();
  assert.notEqual(next, first);
  assert.ok(f.nodes.has('agentmascot-global-root'));
  next.stop();
});

test('stopping during a status request cannot resurrect the mascot', async () => {
  const f = fakeEnv();
  let resolve;
  const handle = startAgentMascotPatchEntry(f.env, { api: { get: () => new Promise(r => { resolve = r; }) } });
  handle.stop();
  resolve(envelope({ enabled: true, mascot: 'kurisu' }));
  await flush();
  assert.equal(f.nodes.size, 0);
  assert.equal(f.intervals.size, 0);
});

test('activating the mascot clicks the native assistant only once', () => {
  const f = fakeEnv();
  const entry = createMoviePilotAgentEntry({ env: f.env });
  entry.open();
  assert.equal(f.clicks(), 1);
  entry.destroy();
});
