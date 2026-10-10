import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
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
  const events = new Map();
  const frames = new Map();
  const logs = [];
  const intervals = new Set();
  const listeners = new Set();
  let serial = 0;
  const classes = new Set();
  const native = { classList: { add: x => classes.add(x), remove: x => classes.delete(x) }, contains: () => false };
  let clicks = 0;
  const trigger = { click: () => clicks++ };
  function element() {
    const handlers = new Map();
    return { style: {}, handlers, children: [], setAttribute() {}, append(...children) { this.children.push(...children); },
      addEventListener(name, fn) { handlers.set(name, fn); },
      removeEventListener(name) { handlers.delete(name); }, remove() { nodes.delete(this.id); } };
  }
  const document = {
    querySelector: selector => selector === '.agent-assistant-fab' ? native : selector === '.agent-assistant-fab__trigger' ? trigger : null,
    querySelectorAll: () => [], getElementById: id => nodes.get(id),
    createElement: element,
    addEventListener(name, fn, options) { events.set(name, { fn, options }); },
    removeEventListener(name) { events.delete(name); },
    body: { appendChild: e => nodes.set(e.id, e) }, head: { appendChild: e => nodes.set(e.id, e) },
  };
  const env = { document, innerWidth: 1200, innerHeight: 800, location: { origin: 'https://mp.test' },
    performance: { now: () => 10 }, getComputedStyle: () => ({}),
    MutationObserver: class { observe() {} disconnect() {} },
    setInterval: () => { intervals.add(++serial); return serial; }, clearInterval: id => intervals.delete(id),
    setTimeout: () => ++serial, clearTimeout() {},
    requestAnimationFrame: fn => { frames.set(++serial, fn); return serial; },
    cancelAnimationFrame: id => frames.delete(id),
    console: Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => logs.push({ level, args })])),
    addEventListener: event => listeners.add(event), removeEventListener: event => listeners.delete(event) };
  return { env, nodes, intervals, listeners, classes, events, frames, logs, clicks: () => clicks,
    move(x, y) { events.get('pointermove').fn({ clientX: x, clientY: y }); },
    tick(time) { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(time); },
    y() { return Number(nodes.get('agentmascot-global-root').style.transform.match(/translate3d\([^,]+, ([^p]+)px/)[1]); },
  };
}

test('global DOM entry gazes nearby and follows distant vertical moves at the live 2x scale', async () => {
  const f = fakeEnv();
  const id = `pet_${'a'.repeat(32)}`;
  const handle = startAgentMascotPatchEntry(f.env, { api: { get: async () => ({ success: true, message: '', data: {
    config: { enabled: true, mascot: id, scale: 2, speed: 2, follow_mouse: true, auto_roam: true },
    pet: { id, version: 2, rows: 11, sprite_url: '/sprite.png' },
  } }) } });
  await flush();
  f.move(276, 224); // target top 120, just 60 px above the initial height.
  assert.equal(f.events.get('pointermove').options.capture, true);
  for (let i = 0; i <= 90; i++) f.tick(i * 1000 / 60);
  assert.equal(f.y(), 180, 'nearby pointer changes gaze without jumping');
  f.move(276, 124); // target top 20, beyond the gaze buffer.
  for (let i = 91; i <= 180; i++) f.tick(i * 1000 / 60);
  assert.ok(Math.abs(f.y() - 20) < 1, `upward landing: ${f.y()}`);
  f.move(276, 444); // target top 340.
  for (let i = 181; i <= 270; i++) f.tick(i * 1000 / 60);
  assert.ok(Math.abs(f.y() - 340) < 1, `downward landing: ${f.y()}`);
  assert.equal(handle.getState().motion.pointerReceived, true);
  assert.equal(handle.getState().motion.gazeRadius, 104);
  assert.ok(Math.abs(handle.getState().motion.verticalThreshold - 124.8) < .01);
  const count = f.logs.length;
  await handle.sync(); await handle.sync();
  assert.equal(f.logs.length, count, 'unchanged config and animation frames do not flood logs');
  handle.stop();
  assert.equal(f.frames.size, 0);
  assert.equal(f.events.size, 0);
});

test('classic loader runs the same vertical-follow runtime and exposes its build revision', async () => {
  const f = fakeEnv();
  const id = `pet_${'b'.repeat(32)}`;
  f.env.URL = URL;
  f.env.fetch = async () => ({ ok: true, json: async () => ({ success: true, message: '', data: {
    config: { enabled: true, mascot: id, scale: 2, speed: 2, follow_mouse: true, auto_roam: false },
    pet: { id, version: 2, rows: 11, sprite_url: '/sprite.png' },
  } }) });
  runInNewContext(readFileSync(new URL('../../../plugins.v3/agentmascot/dist/assets/agentmascot-loader.global.js', import.meta.url), 'utf8'), f.env);
  await flush();
  const handle = f.env.__AgentMascotGlobalLoader;
  assert.match(handle.revision, /^[a-f0-9]{16}$/);
  f.move(276, 224);
  for (let i = 0; i <= 90; i++) f.tick(i * 1000 / 60);
  assert.equal(f.y(), 180);
  f.move(276, 124);
  for (let i = 91; i <= 180; i++) f.tick(i * 1000 / 60);
  assert.ok(Math.abs(f.y() - 20) < 1);
  handle.stop();
});

test('global loader logs configuration failure once and reports recovery', async () => {
  const f = fakeEnv();
  let fail = true;
  const handle = startAgentMascotPatchEntry(f.env, { api: { get: async () => {
    if (fail) throw new Error('offline');
    return envelope({ enabled: false });
  } } });
  await flush();
  await handle.sync(); await handle.sync();
  assert.equal(f.logs.filter(item => item.level === 'error').length, 1);
  assert.equal(handle.getState().error, 'offline');
  fail = false; await handle.sync();
  assert.equal(handle.getState().error, null);
  assert.ok(f.logs.some(item => item.args[0].includes('已恢复')));
  handle.stop();
});

test('a legacy global handle is replaced even when its plugin ID matches', async () => {
  const f = fakeEnv();
  let stops = 0;
  const legacy = { pluginId: 'AgentMascot', stop: () => stops++ };
  f.env.__AgentMascotGlobalLoader = legacy;
  const handle = startAgentMascotPatchEntry(f.env, { api: { get: async () => envelope({ enabled: false }) } });
  await flush();
  assert.notEqual(handle, legacy);
  assert.equal(stops, 1);
  handle.stop();
});

test('global mascot starts once, disables cleanly, and can start again', async () => {
  const f = fakeEnv();
  let enabled = true;
  const options = { api: { get: async () => envelope({ enabled, mascot: 'kurisu', replace_agent_entry: true }) } };
  const first = startAgentMascotPatchEntry(f.env, options);
  await flush();
  assert.ok(f.nodes.has('agentmascot-global-root'));
  assert.ok(f.classes.has('agentmascot-native-hidden'));
  assert.equal(first.getState().mounted, true);
  assert.equal(first.getState().nativeEntryAvailable, true);
  assert.equal(startAgentMascotPatchEntry(f.env, options), first);
  enabled = false;
  await first.sync();
  assert.equal(f.nodes.has('agentmascot-global-root'), false);
  assert.equal(f.classes.size, 0);
  assert.equal(first.getState().mounted, false);
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


test('mobile global entry limits size and keeps the pet above the keyboard and safe areas', async () => {
  const f = fakeEnv();
  const viewportEvents = new Map();
  const viewport = { width: 390, height: 760, offsetLeft: 0, offsetTop: 0,
    addEventListener(name, fn) { viewportEvents.set(name, fn); },
    removeEventListener(name) { viewportEvents.delete(name); } };
  f.env.visualViewport = viewport;
  f.env.innerWidth = 390; f.env.innerHeight = 844;
  f.env.getComputedStyle = () => ({ paddingTop: '44px', paddingBottom: '34px' });
  f.env.matchMedia = () => ({ matches: true });
  const id = `pet_${'c'.repeat(32)}`;
  const config = { enabled: true, mascot: id, scale: 4, auto_roam: false, follow_mouse: true };
  const handle = startAgentMascotPatchEntry(f.env, { api: { get: async () => ({ success: true, message: '', data: {
    config, pet: { id, version: 2, rows: 11, sprite_url: '/sprite.png' },
  } }) } });
  await flush();
  const root = f.nodes.get('agentmascot-global-root');
  assert.ok(parseFloat(root.style.width) <= 120);
  f.events.get('pointermove').fn({ pointerType: 'touch', clientX: 100, clientY: 10 });
  assert.equal(handle.getState().motion.pointerReceived, false, 'page scrolling must not start chasing');
  const event = (type, x, y) => ({ type, pointerType: 'touch', pointerId: 1, button: 0,
    clientX: x, clientY: y, currentTarget: root, preventDefault() {} });
  root.handlers.get('pointerdown')(event('pointerdown', 200, 260));
  root.handlers.get('pointermove')(event('pointermove', 350, 750));
  root.handlers.get('pointerup')(event('pointerup', 350, 750));
  viewport.height = 300; viewport.offsetTop = 20;
  viewportEvents.get('resize')();
  assert.ok(f.y() >= 72);
  assert.ok(f.y() + parseFloat(root.style.height) <= 278.01, 'keyboard and bottom safe area remain clear');
  assert.equal(config.scale, 4, 'responsive sizing does not overwrite the saved scale');
  viewport.offsetTop = 40; viewportEvents.get('scroll')();
  assert.ok(f.y() >= 92);
  handle.stop();
  assert.equal(viewportEvents.size, 0);
  assert.equal(f.nodes.size, 0);
});


test('a failed sprite restores the native assistant instead of leaving an invisible entry', async () => {
  const f = fakeEnv();
  const handle = startAgentMascotPatchEntry(f.env, { api: { get: async () => envelope({ enabled: true, mascot: 'kurisu' }) } });
  await flush();
  const img = f.nodes.get('agentmascot-global-root').children[0].children[0];
  img.handlers.get('error')({ currentTarget: img });
  assert.equal(handle.getState().mounted, false);
  assert.equal(f.classes.size, 0);
  assert.equal(f.frames.size, 0);
  assert.match(handle.getState().error, /图片加载失败/);
  await handle.sync();
  assert.equal(handle.getState().mounted, true);
  img.handlers.get('error')({ currentTarget: img });
  assert.equal(handle.getState().mounted, true, 'late image errors cannot remove a newer mascot');
  handle.stop();
});
