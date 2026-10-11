import { D as DEFAULT_CONFIG, V as VIEWPORT_PADDING, f as buildSurfaceLanes } from './runtime-BCybTabx.js';
import { normalizeConfig, createMascotRuntime, applyMascotImage } from './mascot-runtime.js';
import { createPointerInput } from './pointer-input.js';

const ROOT_CLASS = 'agentmascot-plugin-root';
const SHADOW_CLASS = 'agentmascot-plugin-shadow';
const FALLBACK_BOUNDS = {
  height: 360,
  width: 720,
};

let container = null;
let containerPosition = '';
let config = normalizeConfig(DEFAULT_CONFIG);
let env = globalThis;
let img = null;
let root = null;
let runtime = null;
let onActivate = null;
let shadow = null;
let resizeObserver = null;
const input = createPointerInput({ getRuntime: () => runtime, point: pointFromEvent });

function ownerWindow(element) {
  return element?.ownerDocument?.defaultView || globalThis
}

function schedulerFor(nextEnv) {
  return {
    setInterval: (...args) => nextEnv.setInterval(...args),
    clearInterval: id => nextEnv.clearInterval(id),
    setTimeout: (...args) => nextEnv.setTimeout(...args),
    clearTimeout: id => nextEnv.clearTimeout(id),
    requestAnimationFrame: callback => nextEnv.requestAnimationFrame(callback),
    cancelAnimationFrame: id => nextEnv.cancelAnimationFrame(id),
  }
}

function requireContainer(nextContainer) {
  if (!nextContainer?.ownerDocument || !nextContainer.appendChild) {
    throw new TypeError('[AgentMascot] pluginEntry.mount(container) requires a DOM container')
  }
}

function bounds() {
  const rect = container?.getBoundingClientRect?.();
  return {
    height: rect?.height || FALLBACK_BOUNDS.height,
    width: rect?.width || FALLBACK_BOUNDS.width,
  }
}

function pointFromEvent(event) {
  const rect = container.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function render() {
  if (!root || !img || !runtime) return
  const state = runtime.renderState();
  root.style.width = `${state.size}px`;
  root.style.height = `${state.height || state.size}px`;
  root.style.transform = [
    `translate3d(${state.left}px, ${state.top}px, 0)`,
    `scaleX(${state.flipX ?? (runtime.pet.lookRight ? -1 : 1)})`,
  ].join(' ');
  applyMascotImage(img, state);
  if (shadow) shadow.style.display = runtime.config().shadow ? 'block' : 'none';
}

function onClick(event) {
  if (input.suppressClick()) {
    event.preventDefault();
    return
  }
  onActivate?.(event);
}

function createRoot() {
  const nextRoot = container.ownerDocument.createElement('button');
  nextRoot.type = 'button';
  nextRoot.className = ROOT_CLASS;
  nextRoot.setAttribute('aria-label', '打开智能体助手');
  nextRoot.style.cssText = [
    'position:absolute',
    'top:0',
    'left:0',
    'z-index:1',
    'display:grid',
    'place-items:center',
    'padding:0',
    'border:0',
    'background:transparent',
    'cursor:grab',
    'user-select:none',
    'touch-action:none',
    'will-change:transform',
  ].join(';');

  img = container.ownerDocument.createElement('img');
  img.alt = '';
  img.style.cssText = [
    'width:100%',
    'height:100%',
    'object-fit:contain',
    'pointer-events:none',
    '-webkit-user-drag:none',
  ].join(';');

  shadow = container.ownerDocument.createElement('span');
  shadow.className = SHADOW_CLASS;
  shadow.style.cssText = [
    'position:absolute',
    'left:17%',
    'right:17%',
    'bottom:3px',
    'height:12px',
    'border-radius:999px',
    'background:rgba(0,0,0,.26)',
    'filter:blur(5px)',
    'z-index:-1',
  ].join(';');

  const crop = container.ownerDocument.createElement('span');
  crop.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none';
  crop.append(img);
  nextRoot.append(crop, shadow);
  return nextRoot
}

function attachEvents() {
  container.addEventListener('pointermove', input.hover, { passive: true });
  container.addEventListener('pointerleave', input.leave);
  root.addEventListener('pointerdown', input.down);
  root.addEventListener('pointermove', input.move);
  root.addEventListener('pointerup', input.end);
  root.addEventListener('pointercancel', input.end);
  root.addEventListener('lostpointercapture', input.end);
  root.addEventListener('click', onClick);
}

function detachEvents() {
  container?.removeEventListener('pointermove', input.hover);
  container?.removeEventListener('pointerleave', input.leave);
  root?.removeEventListener('pointerdown', input.down);
  root?.removeEventListener('pointermove', input.move);
  root?.removeEventListener('pointerup', input.end);
  root?.removeEventListener('pointercancel', input.end);
  root?.removeEventListener('lostpointercapture', input.end);
  root?.removeEventListener('click', onClick);
}

function mount(nextContainer, options = {}) {
  requireContainer(nextContainer);
  unmount();

  container = nextContainer;
  containerPosition = container.style.position;
  const computedPosition = ownerWindow(container).getComputedStyle(container).position;
  if (!computedPosition || computedPosition === 'static') {
    container.style.position = 'relative';
  }
  env = options.env || ownerWindow(container);
  config = normalizeConfig(options.config || config);
  onActivate = typeof options.onActivate === 'function' ? options.onActivate : null;
  root = createRoot();
  container.appendChild(root);

  runtime = createMascotRuntime({
    bounds,
    getConfig: () => config,
    getSurfaceLanes: options.getSurfaceLanes || (context => buildSurfaceLanes(context)),
    initialPet: {
      anchorX: Math.min(180, bounds().width / 2),
      anchorY: Math.min(180, bounds().height / 2),
      laneY: Math.min(180, bounds().height / 2),
      targetX: Math.min(360, bounds().width - VIEWPORT_PADDING),
      targetY: Math.min(180, bounds().height / 2),
    },
    onUpdate: render,
    scheduler: schedulerFor(env),
    viewportPadding: options.viewportPadding ?? VIEWPORT_PADDING,
  });
  attachEvents();
  if (env.ResizeObserver) {
    resizeObserver = new env.ResizeObserver(() => { runtime?.clampToBounds(); render(); });
    resizeObserver.observe(container);
  }
  runtime.start();
  render();

  return {
    unmount,
    updateConfig,
  }
}

function unmount() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  input.reset();
  runtime?.stop();
  detachEvents();
  root?.remove();
  if (container) container.style.position = containerPosition;
  container = null;
  containerPosition = '';
  env = globalThis;
  img = null;
  root = null;
  runtime = null;
  onActivate = null;
  shadow = null;
}

function updateConfig(nextConfig) {
  config = normalizeConfig(nextConfig || DEFAULT_CONFIG);
  runtime?.updateConfig(config);
}

export { mount, unmount, updateConfig };
