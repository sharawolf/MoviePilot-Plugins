import { S as SURFACE_SCAN_MS, h as buildDomSurfaceLanes, V as VIEWPORT_PADDING, D as DEFAULT_CONFIG } from './runtime-BCybTabx.js?v=d9a72ff120dfcb19';
import { normalizeConfig, createMascotRuntime, isCustomPet, petAssetUrls, applyMascotImage } from './mascot-runtime.js?v=d9a72ff120dfcb19';
import { u as unwrapResponse } from './provider-mBbtEwEX.js?v=d9a72ff120dfcb19';
import { createPointerInput, viewportGeometry } from './pointer-input.js?v=d9a72ff120dfcb19';

const ENTRY_SELECTOR = '.agent-assistant-fab';
const TRIGGER_SELECTOR = '.agent-assistant-fab__trigger';
const PANEL_SELECTOR = '.agent-assistant-panel';
// Replaced with a content digest in both distribution entry points at build time.
const RUNTIME_REVISION = 'd9a72ff120dfcb19';

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
  let safeArea = null;
  let viewport = viewportGeometry(env);
  const input = createPointerInput({ getRuntime, onInteracting: options.onInteracting, point: event => ({
    x: event.clientX - viewport.left, y: event.clientY - viewport.top,
  }) });

  function runtime() {
    return getRuntime()
  }

  function bounds() {
    return { height: viewport.height, width: viewport.width }
  }

  function collectSurfaceLanes(context, force = false) {
    const now = env.performance?.now?.() || Date.now();
    if (!force && surfaceLanes.length && now - lastSurfaceScan < SURFACE_SCAN_MS) return surfaceLanes

    try {
      surfaceLanes = buildDomSurfaceLanes(context, viewport.compact || viewport.left || viewport.top ? [] : env.document.querySelectorAll(DOM_SURFACE_SELECTORS), {
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
    root.style.height = `${state.height || state.size}px`;
    root.style.transform = `translate3d(${state.left + viewport.left}px, ${state.top + viewport.top}px, 0) scaleX(${state.flipX ?? (pet.lookRight ? -1 : 1)})`;
    applyMascotImage(img, state);
    shadow.style.display = runtime().config().shadow ? 'block' : 'none';
    options.onAnchor?.({ x: state.left + viewport.left, y: state.top + viewport.top,
      width: state.size, height: state.height || state.size });
  }

  function onClick(event) {
    if (input.suppressClick()) {
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
        z-index: ${options.container ? 1 : 2147483000};
        pointer-events: auto;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        background: transparent;
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
    safeArea = env.document.createElement('span');
    safeArea.id = 'agentmascot-safe-area';
    safeArea.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    safeArea.setAttribute('aria-hidden', 'true');
    (options.container || env.document.body).appendChild(safeArea);
    viewport = viewportGeometry(env, env.getComputedStyle(safeArea));
    root = env.document.createElement('button');
    root.id = ROOT_ID;
    root.type = 'button';
    root.setAttribute('aria-label', '打开智能体助手');
    img = env.document.createElement('img');
    img.alt = '';
    img.addEventListener('error', event => {
      if (event.currentTarget === img) options.onAssetError?.();
    });
    img.addEventListener('load', event => {
      if (event.currentTarget === img) options.onAssetLoad?.();
    });
    shadow = env.document.createElement('span');
    shadow.className = 'agentmascot-global-shadow';
    const crop = env.document.createElement('span');
    crop.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none';
    crop.append(img);
    root.append(crop, shadow);
    (options.container || env.document.body).appendChild(root);
    env.document.addEventListener('pointermove', input.hover, { passive: true, capture: true });
    env.document.addEventListener('pointerleave', input.leave);
    root.addEventListener('pointerdown', input.down);
    root.addEventListener('pointermove', input.move);
    root.addEventListener('pointerup', input.end);
    root.addEventListener('pointercancel', input.end);
    root.addEventListener('lostpointercapture', input.end);
    root.addEventListener('click', onClick);
  }

  function unmount() {
    env.document.removeEventListener('pointermove', input.hover, true);
    env.document.removeEventListener('pointerleave', input.leave);
    input.reset();
    options.onAnchor?.(null);
    safeArea?.remove();
    safeArea = null;
    root?.remove();
    root = null;
    img = null;
    shadow = null;
  }

  function onResize() {
    viewport = viewportGeometry(env, safeArea ? env.getComputedStyle(safeArea) : {});
    surfaceLanes = [];
    input.leave();
    runtime().clampToBounds();
    render();
  }

  return {
    bounds,
    config: config => ({ ...config, scale: Math.min(config.scale, viewport.maxScale) }),
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
    return normalizeConfig({ ...data.config, _pet: petAssetUrls(data.pet, options.env || globalThis) })
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
  return normalizeConfig({ ...data.config, _pet: petAssetUrls(data.pet, env) })
}

const PLUGIN_ID = 'AgentMascot';
const HIDDEN_CLASS = 'agentmascot-native-hidden';
const CONFIG_POLL_MS = 15000;

function startAgentMascotPatchEntry(env = globalThis, options = {}) {
  const pluginId = options.pluginId || PLUGIN_ID;
  const mode = options.container ? 'stage' : 'legacy';
  const isStage = mode === 'stage';
  const previous = env.__AgentMascotGlobalLoader;
  // A page or an old standalone script must not replace the host-owned stage.
  if (!isStage && previous?.mode === 'stage') return previous
  if (previous?.pluginId === pluginId && previous.revision === RUNTIME_REVISION
      && (previous.mode || 'legacy') === mode && (!isStage || previous.container === options.container)) return previous
  previous?.stop?.();
  let stopped = false;
  let syncing = false;
  let lastConfigLog = '';
  let lastError = '';
  let assetError = '';
  const log = (level, message, detail) => env.console?.[level]?.(`[AgentMascot] ${message}`, detail);
  if (previous) log('info', '替换旧桌宠运行器', { previous: previous.revision || 'legacy', revision: RUNTIME_REVISION });

  let config = { ...DEFAULT_CONFIG };
  let configTimer = 0;
  let mounted = false;
  let runtime = null;
  const isEnabled = () => Boolean(config.enabled && config.replace_agent_entry && (!isCustomPet(config.mascot) || config._pet));
  const agentEntry = isStage ? {
    contains: element => Boolean(options.container.contains?.(element)),
    open: () => options.agent.open(),
    hide() {}, startObserver() {},
    destroy() { options.pet.setBubbleAnchor(null); options.pet.setInteracting(false); },
  } : createMoviePilotAgentEntry({
    env,
    hiddenClass: HIDDEN_CLASS,
    isEnabled,
  });
  const adapter = createGlobalDomAdapter({
    agentEntry,
    env,
    container: options.container,
    getRuntime: () => runtime,
    nativeEntryStyle: isStage ? '' : nativeAgentEntryStyle(HIDDEN_CLASS),
    onAnchor: isStage ? rect => options.pet.setBubbleAnchor(rect) : undefined,
    onInteracting: isStage ? value => options.pet.setInteracting(value) : undefined,
    onAssetError() {
      unmount();
      if (!assetError) log('error', '角色图片加载失败，已恢复原生助手入口');
      assetError = '角色图片加载失败，已恢复原生助手入口';
      if (isStage && !stopped) options.onError?.(new Error(assetError));
    },
    onAssetLoad() { if (assetError) log('info', '角色图片加载已恢复'); assetError = ''; },
  });

  runtime = createMascotRuntime({
    bounds: adapter.bounds,
    getConfig: () => adapter.config(config),
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
      clearTimeout: id => env.clearTimeout(id),
      requestAnimationFrame: callback => env.requestAnimationFrame(callback),
      cancelAnimationFrame: id => env.cancelAnimationFrame(id),
    },
    viewportPadding: VIEWPORT_PADDING,
  });

  async function loadConfig() {
    const next = await loadMoviePilotPluginConfig(pluginId, { ...options, env });
    if (stopped) return
    config = next;
    runtime.updateConfig(config);
    const detail = { pluginId, revision: RUNTIME_REVISION, enabled: config.enabled,
      mascot: config.mascot, renderer: isCustomPet(config.mascot) ? 'codex-pet' : 'builtin',
      followMouse: config.follow_mouse, autoRoam: config.auto_roam, scale: config.scale, speed: config.speed,
      assetAvailable: !isCustomPet(config.mascot) || Boolean(config._pet) };
    const signature = JSON.stringify(detail);
    if (signature !== lastConfigLog) {
      log(detail.assetAvailable ? 'info' : 'warn', '桌宠页面配置已应用', detail);
      lastConfigLog = signature;
    }
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
    log('info', '全局桌宠已挂载', { revision: RUNTIME_REVISION });
  }

  function unmount() {
    if (!mounted) return
    runtime.stop();
    agentEntry.destroy();
    adapter.unmount();
    mounted = false;
    log('info', '全局桌宠已卸载');
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
        if (isStage) throw new Error('桌宠已停用或所选角色不可用');
      }
      if (lastError) log('info', '全局入口配置读取已恢复');
      lastError = '';
    } catch (error) {
      if (stopped) return
      unmount();
      const message = String(error?.message || error);
      if (lastError !== message) log('error', '全局入口配置读取失败', message);
      lastError = message;
      if (isStage) options.onError?.(error);
    } finally {
      syncing = false;
    }
  }

  const ready = syncFromConfig();
  configTimer = env.setInterval(syncFromConfig, CONFIG_POLL_MS);
  env.addEventListener('resize', adapter.onResize);
  env.visualViewport?.addEventListener('resize', adapter.onResize);
  env.visualViewport?.addEventListener('scroll', adapter.onResize);

  const handle = {
    pluginId,
    mode,
    container: options.container,
    ready,
    revision: RUNTIME_REVISION,
    sync: syncFromConfig,
    getState() {
      return {
        mounted,
        syncing,
        stopped,
        revision: RUNTIME_REVISION,
        renderer: isCustomPet(config.mascot) ? 'codex-pet' : 'builtin',
        motion: runtime.debugState(),
        error: lastError || assetError || null,
        mode,
        nativeEntryAvailable: isStage ? Boolean(options.agent.getState().available) : Boolean(env.document.querySelector(TRIGGER_SELECTOR)),
      }
    },
    stop() {
      if (stopped) return
      stopped = true;
      env.clearInterval(configTimer);
      env.removeEventListener('resize', adapter.onResize);
      env.visualViewport?.removeEventListener('resize', adapter.onResize);
      env.visualViewport?.removeEventListener('scroll', adapter.onResize);
      unmount();
      env.document.getElementById(STYLE_ID)?.remove();
      if (env.__AgentMascotGlobalLoader === handle) delete env.__AgentMascotGlobalLoader;
    },
  };
  env.__AgentMascotGlobalLoader = handle;
  return handle
}

function startAgentMascotStage(container, options = {}) {
  if (!container?.ownerDocument || !container.appendChild || !options.agent?.open
      || !options.pet?.setBubbleAnchor || !options.pet?.setInteracting) {
    throw new TypeError('AgentMascot stage requires the host container, agent and pet context')
  }
  return startAgentMascotPatchEntry(options.env || container.ownerDocument.defaultView, { ...options, container })
}

export { startAgentMascotPatchEntry, startAgentMascotStage, loadMoviePilotPluginConfig, moviePilotApiUrl, createMoviePilotAgentEntry, RUNTIME_REVISION };
