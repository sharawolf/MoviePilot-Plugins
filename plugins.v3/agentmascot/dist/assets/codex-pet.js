// Codex sprite layout: 192×208 cells, eight columns; v2 adds a 16-pose look ring.
const STATES = {
  idle: [0, 6], right: [1, 8], left: [2, 8], waving: [3, 4], jumping: [4, 5],
  failed: [5, 8], waiting: [6, 6], working: [7, 6], review: [8, 6],
}
const ALIASES = { walk: 'right', run: 'right', jump: 'jumping', cheer: 'waving', think: 'working' }

export function createCodexPetRuntime(options) {
  const scheduler = options.scheduler || globalThis
  let localConfig = options.config || {}
  const config = () => options.getConfig?.() || localConfig
  const initialPet = { anchorX: 80, anchorY: 180, lookRight: true, ...options.initialPet }
  const pet = { ...initialPet }
  let animation = 0, running = false, previous = 0, elapsed = 0
  let manual = null, pointer = null, drag = null, suppressUntil = 0
  let state = 'idle', pose = 0
  const frameCount = name => config()._pet?.frame_map?.[STATES[name][0]]?.length || STATES[name][1]
  const dimensions = () => {
    const bounds = options.bounds?.() || { width: 640, height: 360 }
    const size = Math.min(96 * (config().scale || 1), Math.max(24, bounds.width - 16), Math.max(24, (bounds.height - 16) * 192 / 208))
    return { ...bounds, size, spriteHeight: size * 208 / 192 }
  }
  function clampToBounds() {
    const bounds = dimensions()
    pet.anchorX = Math.max(0, Math.min(pet.anchorX, bounds.width - bounds.size))
    pet.anchorY = Math.max(0, Math.min(pet.anchorY, bounds.height - bounds.spriteHeight))
  }
  function update(dt) {
    elapsed += dt
    clampToBounds()
    if (manual && elapsed >= manual.until) manual = null
    state = manual?.name || 'idle'
    if (!drag && !manual) {
      const d = dimensions()
      const delta = pointer && config().follow_mouse ? pointer.x - pet.anchorX - d.size / 2 : 0
      const moving = Math.abs(delta) > d.size || (!pointer && config().auto_roam && elapsed % 10000 < 4500)
      if (moving) {
        if (delta) pet.lookRight = delta > 0
        if (pet.anchorX <= 0) pet.lookRight = true
        if (pet.anchorX >= d.width - d.size) pet.lookRight = false
        pet.anchorX += (pet.lookRight ? 1 : -1) * dt * .055 * (config().speed || 1)
        state = pet.lookRight ? 'right' : 'left'
        clampToBounds()
      }
    }
    if (drag) state = pet.lookRight ? 'right' : 'left'
    pose = Math.floor((elapsed - (manual?.start || 0)) / 120) % frameCount(state)
  }
  function tick(time) {
    if (!running) return
    const dt = previous ? Math.max(0, Math.min(48, time - previous)) : 16
    previous = time
    update(dt)
    options.onUpdate?.()
    if (running) animation = scheduler.requestAnimationFrame(tick)
  }
  function start() {
    if (running) return
    running = true
    previous = 0
    animation = scheduler.requestAnimationFrame(tick)
  }
  function stop() {
    running = false
    scheduler.cancelAnimationFrame(animation)
    animation = 0
  }
  function playAction(name) {
    name = ALIASES[name] || name
    if (!STATES[name]) return false
    manual = { name, start: elapsed, until: elapsed + frameCount(name) * 120 }
    state = name
    pose = 0
    options.onUpdate?.()
    return true
  }
  function renderState() {
    clampToBounds()
    const profile = config()._pet
    const d = dimensions()
    let row = STATES[state][0], column = pose
    if (profile?.version === 2 && pointer && config().follow_mouse && state === 'idle' && !manual && !drag) {
      const dx = pointer.x - pet.anchorX - d.size / 2
      const dy = pointer.y - pet.anchorY - d.spriteHeight / 2
      if (Math.hypot(dx, dy) > 12) {
        const direction = Math.round(((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 8)) % 16
        row = 9 + Math.floor(direction / 8)
        column = direction % 8
      }
    }
    const frames = profile?.frame_map?.[row]
    if (frames?.length) [row, column] = frames[column % frames.length]
    return {
      size: d.size, height: d.spriteHeight, left: pet.anchorX, top: pet.anchorY,
      frame: profile?.sprite_url || '', flipX: 1, row, column,
      imageStyle: { position: 'absolute', width: `${d.size * 8}px`, height: `${d.spriteHeight * (profile?.rows || 9)}px`,
        maxWidth: 'none', objectFit: 'fill', left: `${-column * d.size}px`, top: `${-row * d.spriteHeight}px` },
    }
  }
  function resetPose() {
    manual = null; state = 'idle'; pose = 0
    pet.anchorX = initialPet.anchorX; pet.anchorY = initialPet.anchorY
    clampToBounds(); options.onUpdate?.()
  }
  return {
    pet, config, start, stop, clampToBounds, renderState, resetPose, playAction,
    playBehavior: name => name === 'rest' ? playAction('idle') : false,
    updateConfig(next) { localConfig = next; clampToBounds() },
    debugState: () => ({ action: state, surface: 'free', state: drag ? 'drag' : state, poseIndex: pose }),
    handlePointerMove(point) { pointer = point }, handlePointerLeave() { pointer = null },
    startDrag(point) { if (point) drag = { x: point.x - pet.anchorX, y: point.y - pet.anchorY, startX: point.x, startY: point.y } },
    moveDrag(point, dx = 0) {
      if (!drag || !point) return
      pet.anchorX = point.x - drag.x; pet.anchorY = point.y - drag.y
      if (dx) pet.lookRight = dx > 0
      if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > 5) suppressUntil = Date.now() + 500
      clampToBounds(); options.onUpdate?.()
    },
    endDrag() { drag = null; clampToBounds(); options.onUpdate?.() },
    shouldSuppressClick: () => Date.now() < suppressUntil,
    celebrate: () => playAction('waving'),
  }
}
