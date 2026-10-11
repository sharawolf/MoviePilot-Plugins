import { n as builtinNormalize, e as createBuiltinRuntime, g as builtinProfile } from './runtime-BCybTabx.js?v=d9a72ff120dfcb19';
import { createCodexPetRuntime } from './codex-pet.js?v=d9a72ff120dfcb19';

const isCustomPet = name => /^pet_[0-9a-f]{32}$/.test(name || '')
const renderedImages = new WeakMap()
function applyMascotImage(img, state) {
  const previous = renderedImages.get(img) || { styles: {} }
  if (previous.frame !== state.frame) img.src = state.frame
  const styles = { position: 'static', width: '100%', height: '100%', maxWidth: '100%',
    objectFit: 'contain', left: '0', top: '0', transform: 'none', willChange: 'auto', ...state.imageStyle }
  for (const [key, value] of Object.entries(styles)) {
    if (previous.styles[key] !== value) img.style[key] = value
  }
  renderedImages.set(img, { frame: state.frame, styles })
}
function normalizeConfig(config = {}) {
  const result = builtinNormalize(config)
  if (isCustomPet(config?.mascot)) result.mascot = config.mascot
  if (config?._pet) result._pet = config._pet
  return result
}
function cloneConfig(config) {
  const result = normalizeConfig(config)
  delete result._pet
  return JSON.parse(JSON.stringify(result))
}
function petAssetUrls(pet, env = globalThis) {
  if (!pet || !pet.sprite_url?.startsWith('/')) return pet
  const base = env.document?.querySelector?.('base')?.href || (env.location?.origin ? `${env.location.origin}/` : null)
  return { ...pet, sprite_url: base ? new URL(pet.sprite_url.slice(1), base).href : pet.sprite_url }
}
function resolveMascotProfile(name, pets = []) {
  if (!isCustomPet(name)) return builtinProfile(name)
  const pet = pets.find(item => item.id === name)
  return pet ? { ...pet, label: pet.name } : { label: '未找到导入角色', icon: '', missing: true }
}
function createMascotRuntime(options = {}) {
  let localConfig = normalizeConfig(options.getConfig?.() || options.config)
  let delegate, custom, started = false
  const clock = options.scheduler || globalThis
  const timeouts = new Set()
  const scheduler = { ...Object.fromEntries(['setInterval', 'clearInterval', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
    .filter(name => typeof clock[name] === 'function').map(name => [name, clock[name].bind(clock)])),
    setTimeout(callback, delay) {
      const id = clock.setTimeout(() => { timeouts.delete(id); callback() }, delay)
      timeouts.add(id)
      return id
    },
  }
  function clearDelayedActions() {
    for (const id of timeouts) clock.clearTimeout?.(id)
    timeouts.clear()
  }
  const current = () => normalizeConfig(options.getConfig?.() || localConfig)
  function select() {
    custom = isCustomPet(current().mascot)
    delegate = (custom ? createCodexPetRuntime : createBuiltinRuntime)({ ...options, scheduler, getConfig: current })
  }
  select()
  const runtime = {
    get pet() { return delegate.pet }, config: current,
    start() { started = true; delegate.start() },
    stop() { started = false; delegate.stop(); clearDelayedActions() },
    updateConfig(next) {
      localConfig = normalizeConfig(next)
      if (custom !== isCustomPet(current().mascot)) {
        delegate.stop(); clearDelayedActions(); select(); if (started) delegate.start()
      } else delegate.updateConfig(current())
    },
  }
  for (const method of ['renderState','debugState','clampToBounds','resetPose','playAction','playBehavior',
    'shouldSuppressClick','celebrate','handlePointerMove','handlePointerLeave','startDrag','moveDrag','endDrag']) {
    runtime[method] = (...args) => delegate[method](...args)
  }
  return runtime
}

export { normalizeConfig, cloneConfig, createMascotRuntime, resolveMascotProfile, isCustomPet, petAssetUrls, applyMascotImage };
