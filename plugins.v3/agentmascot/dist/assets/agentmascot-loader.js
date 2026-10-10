import { S as SURFACE_SCAN_MS, h as buildDomSurfaceLanes, V as VIEWPORT_PADDING, n as normalizeConfig, D as DEFAULT_CONFIG, e as createMascotRuntime } from './runtime-BCybTabx.js';
import { u as unwrapResponse } from './provider-mBbtEwEX.js';

const ENTRY_SELECTOR = '.agent-assistant-fab';
const TRIGGER_SELECTOR = '.agent-assistant-fab__trigger';
const PANEL_SELECTOR = '.agent-assistant-panel';

function nativeAgentEntryStyle(hiddenClass) {
  return `
    .${hiddenClass} {
      pointer-events: none !important;
    }
    .${hiddenClass} > ${TRIGGER_SELECTOR},
    .${hiddenClass} > button,
    .${hiddenClass} [role="button"] {
      opacity: 0 !important;
      pointer-events: none !important;
      transform: scale(0.01) !important;
    }
  `
}

function createMoviePilotAgentEntry(options = {}) {
  const env = options.env || globalThis;
  const hiddenClass = options.hiddenClass || 'agentmascot-native-hidden';
  const isEnabled = options.isEnabled || (() => true);
  let nativeEntry = null;
  let nativeTrigger = null;
  let nativeObserver = null;
  let restoreNativeTimer = 0;

  function refresh() {
    nativeEntry = env.document?.querySelector(ENTRY_SELECTOR) || null;
    nativeTrigger = env.document?.querySelector(TRIGGER_SELECTOR) || null;
    if (nativeEntry) nativeEntry.classList.add(hiddenClass);
  }

  function trigger() {
    if (!nativeTrigger) return
    if (typeof nativeTrigger.click === 'function') nativeTrigger.click();
    else nativeTrigger.dispatchEvent(new env.MouseEvent('click', { bubbles: true, cancelable: true, view: env }));
  }

  function isPanelOpen() {
    const panel = env.document?.querySelector(PANEL_SELECTOR);
    if (!panel) return false
    const style = env.getComputedStyle(panel);
    const rect = panel.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
  }

  function open() {
    refresh();
    if (!nativeTrigger) return
    if (!isPanelOpen()) trigger();
    env.clearTimeout(restoreNativeTimer);
    restoreNativeTimer = env.setTimeout(refresh, 300);
  }

  function contains(element) {
    return Boolean(element && nativeEntry?.contains(element))
  }

  function startObserver() {
    refresh();
    if (nativeObserver) return
    nativeObserver = new env.MutationObserver(() => {
      if (isEnabled()) refresh();
    });
    nativeObserver.observe(env.document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    nativeObserver?.disconnect();
    nativeObserver = null;
  }

  function destroy() {
    stopObserver();
    env.clearTimeout(restoreNativeTimer);
    nativeEntry?.classList.remove(hiddenClass);
    nativeEntry = null;
    nativeTrigger = null;
  }

  return {
    contains,
    destroy,
    hide: refresh,
    open,
    startObserver,
    stopObserver,
  }
}

const ROOT_ID = 'agentmascot-global-root';
const STYLE_ID = 'agentmascot-global-style';
const DOM_SURFACE_SELECTORS = [
  'main',
  '.v-main',
  '.v-container',
  '.v-card',
  '.v-sheet',
  '.v-window',
  '.v-table',
  '[class*="dashboard"]',
  '[class*="layout"]',
].join(',');

function createGlobalDomAdapter(options = {}) {
  const env = options.env || globalThis;
  const agentEntry = options.agentEntry;
  const getRuntime = options.getRuntime;
  let root = null;
  let img = null;
  let shadow = null;
  let surfaceLanes = [];
  let lastSurfaceScan = 0;

  function runtime() {
    return getRuntime()
  }

  function bounds() {
    return {
      height: env.innerHeight,
      width: env.innerWidth,
    }
  }

  function collectSurfaceLanes(context, force = false) {
    const now = env.performance?.now?.() || Date.now();
    if (!force && surfaceLanes.length && now - lastSurfaceScan < SURFACE_SCAN_MS) return surfaceLanes

    try {
      surfaceLanes = buildDomSurfaceLanes(context, env.document.querySelectorAll(DOM_SURFACE_SELECTORS), {
        getStyle: element => env.getComputedStyle(element),
        onError: error => console.debug('[AgentMascot] surface element skipped', error),
        shouldIgnoreElement: element => element === root || root?.contains(element) || agentEntry.contains(element),
        viewportPadding: VIEWPORT_PADDING,
      });
    } catch (error) {
      console.debug('[AgentMascot] surface scan skipped', error);
      surfaceLanes = buildDomSurfaceLanes(context, []);
    }

    lastSurfaceScan = now;
    return surfaceLanes
  }

  function render() {
    if (!root || !img) return
    const state = runtime().renderState();
    const pet = runtime().pet;
    root.style.width = `${state.size}px`;
    root.style.height = `${state.size}px`;
    root.style.transform = `translate3d(${state.left}px, ${state.top}px, 0) scaleX(${pet.lookRight ? -1 : 1})`;
    img.src = state.frame;
    shadow.style.display = runtime().config().shadow ? 'block' : 'none';
  }

  function onPointerMove(event) {
    runtime().handlePointerMove({ x: event.clientX, y: event.clientY });
  }

  function startDrag(event) {
    if (event.button !== 0) return
    event.preventDefault();
    runtime().startDrag({ x: event.clientX, y: event.clientY });
    root?.setPointerCapture?.(event.pointerId);
  }

  function onDrag(event) {
    runtime().moveDrag({ x: event.clientX, y: event.clientY }, event.movementX);
  }

  function endDrag(event) {
    runtime().endDrag({ x: event.clientX, y: event.clientY }, event.movementX, event.movementY);
    root?.releasePointerCapture?.(event.pointerId);
  }

  function onClick(event) {
    if (runtime().shouldSuppressClick()) {
      event.preventDefault();
      return
    }
    event.preventDefault();
    agentEntry.open();
  }

  function ensureStyle() {
    if (env.document.getElementById(STYLE_ID)) return
    const style = env.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${options.nativeEntryStyle || ''}
      #${ROOT_ID} {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 2147483000;
        display: grid;
        place-items: center;
        cursor: grab;
        user-select: none;
        touch-action: none;
        will-change: transform;
      }
      #${ROOT_ID}:active {
        cursor: grabbing;
      }
      #${ROOT_ID} img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        -webkit-user-drag: none;
      }
      #${ROOT_ID} .agentmascot-global-shadow {
        position: absolute;
        left: 17%;
        right: 17%;
        bottom: 3px;
        height: 12px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.26);
        filter: blur(5px);
        z-index: -1;
      }
    `;
    env.document.head.appendChild(style);
  }

  function mount() {
    if (root) return
    ensureStyle();
    root = env.document.createElement('button');
    root.id = ROOT_ID;
    root.type = 'button';
    root.setAttribute('aria-label', '打开智能体助手');
    img = env.document.createElement('img');
    img.alt = '';
    shadow = env.document.createElement('span');
    shadow.className = 'agentmascot-global-shadow';
    root.append(img, shadow);
    env.document.body.appendChild(root);
    env.document.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerdown', startDrag);
    root.addEventListener('pointermove', onDrag);
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
    root.addEventListener('click', onClick);
  }

  function unmount() {
    env.document.removeEventListener('pointermove', onPointerMove);
    root?.remove();
    root = null;
    img = null;
    shadow = null;
  }

  function onResize() {
    runtime().clampToBounds();
  }

  return {
    bounds,
    collectSurfaceLanes,
    mount,
    onResize,
    render,
    unmount,
  }
}

function moviePilotApiUrl(path, env = globalThis) {
  const base = env.document?.querySelector('base')?.href || `${env.location.origin}/`;
  return new URL(path.replace(/^\//, ''), base).href
}

async function loadMoviePilotPluginConfig(pluginId, options = {}) {
  if (options.api?.get) {
    const payload = await options.api.get(`plugin/${pluginId}/status`, { feedback: 'silent' });
    const data = unwrapResponse(payload);
    if (!data?.config) throw new Error('AgentMascot status has no config')
    return normalizeConfig(data.config)
  }
  const env = options.env || globalThis;
  const fetchImpl = options.fetchImpl || env.fetch?.bind(env);
  if (!fetchImpl) throw new Error('MoviePilot fetch is unavailable')
  const response = await fetchImpl(moviePilotApiUrl(`/api/v1/plugin/${pluginId}/public_status`, env), {
    credentials: 'same-origin', cache: 'no-store',
  });
  if (!response.ok) throw new Error(`${pluginId} status ${response.status}`)
  const data = unwrapResponse(await response.json());
  if (!data?.config) throw new Error('AgentMascot status has no config')
  return normalizeConfig(data.config)
}

const PLUGIN_ID = 'AgentMascot';
const HIDDEN_CLASS = 'agentmascot-native-hidden';
const CONFIG_POLL_MS = 15000;

function startAgentMascotPatchEntry(env = globalThis, options = {}) {
  const pluginId = options.pluginId || PLUGIN_ID;
  const previous = env.__AgentMascotGlobalLoader;
  if (previous?.pluginId === pluginId) return previous
  previous?.stop();
  let stopped = false;
  let syncing = false;

  let config = { ...DEFAULT_CONFIG };
  let configTimer = 0;
  let mounted = false;
  let runtime = null;
  const isEnabled = () => Boolean(config.enabled && config.replace_agent_entry);
  const agentEntry = createMoviePilotAgentEntry({
    env,
    hiddenClass: HIDDEN_CLASS,
    isEnabled,
  });
  const adapter = createGlobalDomAdapter({
    agentEntry,
    env,
    getRuntime: () => runtime,
    nativeEntryStyle: nativeAgentEntryStyle(HIDDEN_CLASS),
  });

  runtime = createMascotRuntime({
    bounds: adapter.bounds,
    getConfig: () => config,
    getSurfaceLanes: adapter.collectSurfaceLanes,
    initialPet: {
      anchorX: 180,
      anchorY: 180,
      targetX: 360,
      targetY: 180,
      laneY: 180,
    },
    onUpdate: adapter.render,
    scheduler: {
      setInterval: (...args) => env.setInterval(...args),
      clearInterval: id => env.clearInterval(id),
      setTimeout: (...args) => env.setTimeout(...args),
      requestAnimationFrame: callback => env.requestAnimationFrame(callback),
      cancelAnimationFrame: id => env.cancelAnimationFrame(id),
    },
    viewportPadding: VIEWPORT_PADDING,
  });

  async function loadConfig() {
    config = await loadMoviePilotPluginConfig(pluginId, { ...options, env });
    runtime.updateConfig(config);
    return config
  }

  function mount() {
    if (mounted) {
      agentEntry.hide();
      return
    }
    adapter.mount();
    agentEntry.startObserver();
    agentEntry.hide();
    runtime.start();
    mounted = true;
  }

  function unmount() {
    if (!mounted) return
    runtime.stop();
    agentEntry.destroy();
    adapter.unmount();
    mounted = false;
  }

  async function syncFromConfig() {
    if (stopped || syncing) return
    syncing = true;
    try {
      await loadConfig();
      if (stopped) return
      if (isEnabled()) {
        mount();
        agentEntry.hide();
        adapter.render();
      } else {
        unmount();
      }
    } catch (error) {
      unmount();
      console.debug('[AgentMascot] 全局入口配置读取失败', error);
    } finally {
      syncing = false;
    }
  }

  syncFromConfig();
  configTimer = env.setInterval(syncFromConfig, CONFIG_POLL_MS);
  env.addEventListener('resize', adapter.onResize);

  const handle = {
    pluginId,
    sync: syncFromConfig,
    stop() {
      stopped = true;
      env.clearInterval(configTimer);
      env.removeEventListener('resize', adapter.onResize);
      unmount();
      env.document.getElementById(STYLE_ID)?.remove();
      if (env.__AgentMascotGlobalLoader === handle) delete env.__AgentMascotGlobalLoader;
    },
  };
  env.__AgentMascotGlobalLoader = handle;
  return handle
}

export { startAgentMascotPatchEntry, loadMoviePilotPluginConfig, moviePilotApiUrl, createMoviePilotAgentEntry };
