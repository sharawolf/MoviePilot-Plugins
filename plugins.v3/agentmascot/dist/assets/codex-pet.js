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
  let animation = 0, running = false, previous = null, elapsed = 0
  let manual = null, pointer = null, drag = null, suppressUntil = 0
  let state = 'idle', pose = 0, poseElapsed = 0, vx = 0
  let jump = null, tracking = false, nextHopAt = 6500, followHopAfter = 0, restUntil = 0
  const frameCount = name => config()._pet?.frame_map?.[STATES[name][0]]?.length || STATES[name][1]
  const speed = () => Math.max(.4, Math.min(2, Number(config().speed) || 1))
  const walking = name => name === 'right' || name === 'left'
  const frameMs = name => walking(name) ? 70 / speed() : 120
  const dimensions = () => {
    const bounds = options.bounds?.() || { width: 640, height: 360 }
    const size = Math.min(96 * (config().scale || 1), Math.max(24, bounds.width - 16), Math.max(24, (bounds.height - 16) * 192 / 208))
    return { ...bounds, size, spriteHeight: size * 208 / 192 }
  }
  function clampToBounds(bounds = dimensions()) {
    pet.anchorX = Math.max(0, Math.min(pet.anchorX, bounds.width - bounds.size))
    pet.anchorY = Math.max(0, Math.min(pet.anchorY, bounds.height - bounds.spriteHeight))
  }
  function setState(next) {
    if (state !== next && !(walking(state) && walking(next))) poseElapsed = 0
    state = next
  }
  function beginJump(targetY = pet.anchorY) {
    const d = dimensions()
    targetY = Math.max(0, Math.min(targetY, d.height - d.spriteHeight))
    jump = { start: elapsed, from: pet.anchorY, to: targetY,
      height: Math.min(96, d.size * .65, pet.anchorY, targetY), duration: 700 / Math.sqrt(speed()) }
    nextHopAt = elapsed + jump.duration + 6000
    followHopAfter = elapsed + jump.duration + 500
    setState('jumping')
    pose = 0
  }
  function update(dt) {
    elapsed += dt
    const d = dimensions()
    clampToBounds(d)
    if (manual && elapsed >= manual.until) manual = null
    const moveSpeed = 65 * speed() * Math.sqrt(d.size / 96)
    let targetVx = 0
    const follow = pointer && config().follow_mouse
    if (!drag && elapsed >= restUntil) {
      if (manual && walking(manual.name)) targetVx = (manual.name === 'right' ? 1 : -1) * moveSpeed
      else if (!manual && follow) {
        const dx = pointer.x - pet.anchorX - d.size / 2
        if (Math.abs(dx) > d.size * .7) tracking = true
        if (Math.abs(dx) < d.size * .3) tracking = false
        if (tracking) targetVx = Math.sign(dx) * Math.min(moveSpeed, Math.max(0, Math.abs(dx) - d.size * .3) * 4)
        const targetY = pointer.y - d.spriteHeight / 2
        if (!jump && elapsed >= followHopAfter && Math.abs(targetY - pet.anchorY) > d.spriteHeight * .65) beginJump(targetY)
      } else if (!manual && config().auto_roam) {
        tracking = false
        targetVx = (pet.lookRight ? 1 : -1) * moveSpeed
      }
      if (!manual && !jump && config().auto_roam && elapsed >= nextHopAt) beginJump()
    }
    if (drag) vx = 0
    else {
      // Integrate exponential acceleration analytically so 30/60/120 Hz agree.
      const decay = Math.exp(-dt / 110), before = vx
      vx = targetVx + (vx - targetVx) * decay
      pet.anchorX += (targetVx * dt + (before - targetVx) * 110 * (1 - decay)) / 1000
      const edge = Math.max(0, d.width - d.size)
      if (pet.anchorX <= 0 && vx < 0) { vx = Math.abs(vx); pet.lookRight = true }
      else if (pet.anchorX >= edge && vx > 0) { vx = -Math.abs(vx); pet.lookRight = false }
      else if (Math.abs(vx) > 2) pet.lookRight = vx > 0
    }
    let jumpProgress = 0
    if (jump) {
      const maxY = Math.max(0, d.height - d.spriteHeight)
      jump.from = Math.min(jump.from, maxY); jump.to = Math.min(jump.to, maxY)
      jump.height = Math.min(jump.height, jump.from, jump.to)
      jumpProgress = Math.min(1, (elapsed - jump.start) / jump.duration)
      const t = jumpProgress, blend = t * t * (3 - 2 * t)
      pet.anchorY = jump.from + (jump.to - jump.from) * blend - 4 * jump.height * t * (1 - t)
      if (t === 1) { pet.anchorY = jump.to; jump = null }
    }
    clampToBounds(d)
    setState(jump ? 'jumping' : drag ? (pet.lookRight ? 'right' : 'left')
      : manual?.name || (Math.abs(vx) > 2 ? (pet.lookRight ? 'right' : 'left') : 'idle'))
    poseElapsed += dt * (walking(state) ? Math.min(1, Math.abs(vx) / moveSpeed) : 1)
    pose = jump ? Math.min(frameCount(state) - 1, Math.floor(jumpProgress * frameCount(state)))
      : Math.floor(poseElapsed / frameMs(state)) % frameCount(state)
  }
  function tick(time) {
    if (!running) return
    const dt = previous === null ? 1000 / 60 : Math.max(0, Math.min(64, time - previous))
    previous = time
    update(dt)
    options.onUpdate?.()
    if (running) animation = scheduler.requestAnimationFrame(tick)
  }
  function start() {
    if (running) return
    running = true
    previous = null
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
    jump = null
    if (name === 'jumping') beginJump()
    manual = { name, until: elapsed + (jump?.duration || frameCount(name) * frameMs(name)) }
    setState(name)
    poseElapsed = 0
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
        maxWidth: 'none', objectFit: 'fill', left: '0', top: '0', willChange: 'transform',
        transform: `translate3d(${-column * d.size}px, ${-row * d.spriteHeight}px, 0)` },
    }
  }
  function resetPose() {
    manual = null; jump = null; pointer = null; tracking = false; vx = 0
    state = 'idle'; pose = 0; poseElapsed = 0; nextHopAt = elapsed + 6500
    pet.anchorX = initialPet.anchorX; pet.anchorY = initialPet.anchorY
    clampToBounds(); options.onUpdate?.()
  }
  return {
    pet, config, start, stop, clampToBounds, renderState, resetPose, playAction,
    playBehavior: name => name === 'rest' ? playAction('idle') : false,
    updateConfig(next) { localConfig = next; clampToBounds() },
    debugState: () => ({ action: state, surface: 'free', state: drag ? 'drag' : state, poseIndex: pose,
      vx, targetY: jump?.to ?? pet.anchorY }),
    handlePointerMove(point) { pointer = point }, handlePointerLeave() { pointer = null },
    startDrag(point) {
      if (!point) return
      jump = null; manual = null; vx = 0; tracking = false
      drag = { x: point.x - pet.anchorX, y: point.y - pet.anchorY, startX: point.x, startY: point.y }
    },
    moveDrag(point, dx = 0) {
      if (!drag || !point) return
      pet.anchorX = point.x - drag.x; pet.anchorY = point.y - drag.y
      if (dx) pet.lookRight = dx > 0
      if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > 5) suppressUntil = Date.now() + 500
      clampToBounds(); options.onUpdate?.()
    },
    endDrag() {
      drag = null; pointer = null; restUntil = elapsed + 400; nextHopAt = elapsed + 6500
      clampToBounds(); options.onUpdate?.()
    },
    shouldSuppressClick: () => Date.now() < suppressUntil,
    celebrate: () => playAction('waving'),
  }
}
