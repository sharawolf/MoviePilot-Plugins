// Codex sprite layout: 192×208 cells, eight columns; v2 adds a 16-pose look ring.
const STATES = {
  idle: [0, 6], right: [1, 8], left: [2, 8], waving: [3, 4], jumping: [4, 5],
  failed: [5, 8], waiting: [6, 6], working: [7, 6], review: [8, 6],
}
const ALIASES = { walk: 'right', run: 'right', jump: 'jumping', cheer: 'waving', think: 'working' }
const NATIVE_ACTIONS = ['waving', 'working', 'review', 'waiting', 'failed']

export function createCodexPetRuntime(options) {
  const scheduler = options.scheduler || globalThis
  const random = options.random || Math.random
  let localConfig = options.config || {}
  const config = () => options.getConfig?.() || localConfig
  const initialPet = { anchorX: 80, anchorY: 180, lookRight: true, ...options.initialPet }
  const pet = { ...initialPet }
  let animation = 0, running = false, previous = null, elapsed = 0
  let manual = null, pointer = null, drag = null, suppressUntil = 0
  let state = 'idle', pose = 0, poseElapsed = 0, vx = 0
  let jump = null, fall = null, currentSurface = null, tracking = false, gazeLocked = false
  let holdAirborneAction = false
  let nextHopAt = 6500, followHopAfter = 0, restUntil = 0
  let roamTargetX = null, roamSpeed = 1, nextRoamAt = 1800, autoAction = null, autoActionIndex = 0
  let ambientLook = null, nextLookAt = 0
  const frameCount = name => config()._pet?.frame_map?.[STATES[name][0]]?.length || STATES[name][1]
  const speed = () => Math.max(.4, Math.min(2, Number(config().speed) || 1))
  const walking = name => name === 'right' || name === 'left'
  const gazeRadius = d => Math.max(32, d.spriteHeight / 2)
  const verticalThreshold = d => gazeRadius(d) * 1.2
  const pointerTargetY = d => Math.max(0, Math.min(pointer.y - d.spriteHeight / 2, d.height - d.spriteHeight))
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
  /** 返回当前配置下生效的活动范围。 */
  function activityRange() {
    return ['surfaces', 'floor', 'free'].includes(config().activity_range) ? config().activity_range : 'surfaces'
  }
  /** 返回当前配置下的可站矩形与底边兜底面。 */
  function surfaceList(d = dimensions(), force = false) {
    const mode = activityRange()
    if (mode === 'free') return []
    const floor = { id: 'floor', left: 0, right: d.width, top: d.height, floor: true }
    if (mode === 'floor') return [floor]
    const found = options.getSurfaces?.({ bounds: { width: d.width, height: d.height },
      petHeight: d.spriteHeight, size: d.size }, force)
    const surfaces = Array.isArray(found) ? found.filter(item => item && Number.isFinite(item.left)
      && Number.isFinite(item.right) && Number.isFinite(item.top) && item.right - item.left >= d.size) : []
    return surfaces.some(item => item.floor) ? surfaces : [...surfaces, floor]
  }
  /** 将页面元素上沿转换为精灵顶部坐标。 */
  function surfaceAnchorY(surface, d = dimensions()) {
    return surface.floor ? d.height - d.spriteHeight : Math.max(0, surface.top - d.spriteHeight)
  }
  /** 返回精灵完整落在矩形内时的水平锚点范围。 */
  function surfaceXRange(surface, d = dimensions()) {
    return [Math.max(0, surface.left), Math.max(Math.max(0, surface.left),
      Math.min(d.width - d.size, surface.right - d.size))]
  }
  /** 选择当前高度与水平位置匹配的平台，避免按 DOM 顺序跳层。 */
  function surfaceAt(x, y, d = dimensions()) {
    const tolerance = Math.max(12, d.spriteHeight * .12)
    return surfaceList(d).filter(surface => x >= surface.left - 2 && x + d.size <= surface.right + 2
      && Math.abs(surfaceAnchorY(surface, d) - y) <= tolerance)
      .sort((a, b) => {
        const distance = Math.abs(surfaceAnchorY(a, d) - y) - Math.abs(surfaceAnchorY(b, d) - y)
        if (distance) return distance
        const aCurrent = a.id === currentSurface?.id, bCurrent = b.id === currentSurface?.id
        if (aCurrent !== bCurrent) return aCurrent ? -1 : 1
        return b.top - a.top
      })[0] || null
  }
  /** 只在下落穿过且能够完整承托精灵的平台上着陆。 */
  function landingSurface(previousBottom, currentBottom, d = dimensions()) {
    return surfaceList(d).filter(surface => surface.top >= previousBottom - 10
      && surface.top <= currentBottom + 10 && pet.anchorX >= surface.left
      && pet.anchorX + d.size <= surface.right)
      .sort((a, b) => a.top - b.top)[0] || null
  }
  /** 按顺序循环选择导入图集自带的动作。 */
  function nextNativeAction() {
    const action = NATIVE_ACTIONS[autoActionIndex % NATIVE_ACTIONS.length]
    autoActionIndex++
    return action
  }
  /** 开始沿重力方向下落并清除待执行的地面动作。 */
  function beginFall() {
    if (fall || jump) return false
    manual = null
    holdAirborneAction = false
    autoAction = null
    roamTargetX = null
    currentSurface = null
    fall = { velocity: 0 }
    state = 'jumping'
    pose = 0
    return true
  }
  /** 每次扫描后重新确认脚下平台仍存在且能承托精灵。 */
  function reconcileSurface(d) {
    if (activityRange() === 'free' || drag || jump || fall || holdAirborneAction) return
    const standing = surfaceAt(pet.anchorX, pet.anchorY, d)
    if (!standing) {
      beginFall()
      return
    }
    currentSurface = standing
    pet.anchorY = surfaceAnchorY(standing, d)
  }
  /** 按当前朝向、距离档位与随机步速规划一次自然游走。 */
  function planAutoMove(d) {
    const mode = activityRange()
    const surface = mode === 'free' ? null : currentSurface || surfaceAt(pet.anchorX, pet.anchorY, d)
    const [minimum, maximum] = surface ? surfaceXRange(surface, d) : [0, Math.max(0, d.width - d.size)]
    if (maximum - minimum < 8) return false
    const span = maximum - minimum
    const nearLeft = pet.anchorX - minimum < d.size * .65
    const nearRight = maximum - pet.anchorX < d.size * .65
    let direction = pet.lookRight ? 1 : -1
    if (nearLeft) direction = 1
    else if (nearRight) direction = -1
    else if (random() < .24) direction *= -1
    const band = random()
    const distance = span * (band < .34 ? .18 : band < .78 ? .42 : .76)
    let target = Math.max(minimum, Math.min(maximum, pet.anchorX + direction * Math.max(12, distance)))
    const canWalkOff = mode === 'surfaces' && random() < .12
      && (direction > 0 ? maximum < d.width - d.size - 4 : minimum > 4)
    if (canWalkOff) target = direction > 0 ? maximum + 14 : minimum - 14
    if (Math.abs(target - pet.anchorX) < 8) target = direction > 0 ? maximum : minimum
    roamTargetX = target
    roamSpeed = .72 + random() * .62
    ambientLook = null
    autoAction = null
    return Math.abs(target - pet.anchorX) >= 4
  }
  /** 推进下落并选择轨迹中最近的有效落点。 */
  function updateFall(dt, d) {
    const previousBottom = pet.anchorY + d.spriteHeight
    fall.velocity = Math.min(fall.velocity + 1800 * dt / 1000, 900)
    pet.anchorY += fall.velocity * dt / 1000
    const currentBottom = pet.anchorY + d.spriteHeight
    const landed = landingSurface(previousBottom, currentBottom, d)
    if (landed) {
      pet.anchorY = surfaceAnchorY(landed, d)
      currentSurface = landed
      fall = null
      restUntil = elapsed + 500 + random() * 700
      autoAction = null
      nextRoamAt = restUntil + 300
      poseElapsed = 0
      return
    }
    if (pet.anchorY >= d.height - d.spriteHeight) {
      pet.anchorY = d.height - d.spriteHeight
      currentSurface = surfaceList(d).find(surface => surface.floor) || null
      fall = null
      restUntil = elapsed + 500 + random() * 700
      nextRoamAt = restUntil + 300
    }
  }
  function setState(next) {
    if (state !== next && !(walking(state) && walking(next))) poseElapsed = 0
    state = next
  }
  function beginJump(targetY = pet.anchorY, targetX = null, targetSurface = null) {
    if (jump || fall) return false
    holdAirborneAction = false
    const d = dimensions()
    targetY = Math.max(0, Math.min(targetY, d.height - d.spriteHeight))
    if (targetX !== null) targetX = Math.max(0, Math.min(targetX, d.width - d.size))
    jump = { start: elapsed, from: pet.anchorY, to: targetY, fromX: pet.anchorX, toX: targetX, targetSurface,
      height: Math.min(96, d.size * .65, pet.anchorY, targetY), duration: 700 / Math.sqrt(speed()) }
    nextHopAt = elapsed + jump.duration + 8000 + random() * 9000
    followHopAfter = elapsed + jump.duration + 500
    setState('jumping')
    pose = 0
    return true
  }
  function update(dt) {
    elapsed += dt
    const d = dimensions()
    clampToBounds(d)
    if (manual && elapsed >= manual.until) {
      manual = null
      holdAirborneAction = false
    }
    reconcileSurface(d)
    const moveSpeed = 65 * speed() * Math.sqrt(d.size / 96)
    let targetVx = 0
    const follow = pointer && config().follow_mouse
    if (!follow) gazeLocked = false
    const mode = activityRange()
    if (!drag && !fall && elapsed >= restUntil) {
      if (manual && walking(manual.name)) targetVx = (manual.name === 'right' ? 1 : -1) * moveSpeed
      else if (!manual && follow) {
        const dx = pointer.x - pet.anchorX - d.size / 2
        const dy = pointer.y - pet.anchorY - d.spriteHeight / 2
        const reachableX = Math.max(0, Math.min(pointer.x - d.size / 2, d.width - d.size))
        const moveDx = reachableX - pet.anchorX
        const distance = Math.hypot(dx, dy)
        if (distance <= gazeRadius(d)) gazeLocked = true
        else if (distance > verticalThreshold(d)) gazeLocked = false
        if (!gazeLocked && Math.abs(moveDx) > d.size * .7) tracking = true
        if (gazeLocked || Math.abs(moveDx) < d.size * .3) tracking = false
        if (tracking) targetVx = Math.sign(moveDx) * Math.min(moveSpeed, Math.max(0, Math.abs(moveDx) - d.size * .3) * 4)
        if (mode === 'free') {
          const targetY = pointerTargetY(d)
          if (!gazeLocked && !jump && elapsed >= followHopAfter
              && Math.abs(dy) > verticalThreshold(d) && Math.abs(targetY - pet.anchorY) > 4) beginJump(targetY)
        } else if (mode === 'surfaces' && !gazeLocked && !jump && elapsed >= followHopAfter) {
          const targetSurface = surfaceList(d).filter(surface => pointer.x >= surface.left && pointer.x <= surface.right)
            .sort((a, b) => Math.abs(a.top - pointer.y) - Math.abs(b.top - pointer.y))[0]
          if (targetSurface) {
            const targetY = surfaceAnchorY(targetSurface, d)
            const [left, right] = surfaceXRange(targetSurface, d)
            const targetX = Math.max(left, Math.min(right, pointer.x - d.size / 2))
            if (targetY < pet.anchorY - 4 && Math.abs(dy) > verticalThreshold(d)) beginJump(targetY, targetX, targetSurface)
          }
        }
      } else if (!manual && config().auto_roam) {
        tracking = false
        if (mode === 'surfaces' && !currentSurface) {
          nextRoamAt = elapsed + 300
        } else {
          if (roamTargetX === null && !autoAction && elapsed >= nextRoamAt) planAutoMove(d)
          if (roamTargetX !== null) {
            const distance = roamTargetX - pet.anchorX
            targetVx = Math.sign(distance) * Math.min(moveSpeed * roamSpeed, Math.max(0, Math.abs(distance) - d.size * .12) * 4)
          }
        }
      }
      if (!manual && !follow && !jump && !fall && config().auto_roam && elapsed >= nextHopAt) {
        if (mode === 'free') beginJump()
        else if (mode === 'surfaces' && currentSurface) {
          const candidates = surfaceList(d).filter(surface => surface.id !== currentSurface.id
            && surface.top < currentSurface.top - 12
            && currentSurface.top - surface.top <= d.size * .65)
          if (candidates.length) {
            const targetSurface = candidates[Math.floor(random() * candidates.length)]
            const [left, right] = surfaceXRange(targetSurface, d)
            const targetX = Math.max(left, Math.min(right, pet.anchorX))
            beginJump(surfaceAnchorY(targetSurface, d), targetX, targetSurface)
          } else nextHopAt = elapsed + 8000 + random() * 9000
        } else nextHopAt = elapsed + 8000 + random() * 9000
      }
    }
    if (drag || fall) vx = 0
    else {
      // Integrate exponential acceleration analytically so 30/60/120 Hz agree.
      const decay = Math.exp(-dt / 110), before = vx
      vx = targetVx + (vx - targetVx) * decay
      pet.anchorX += (targetVx * dt + (before - targetVx) * 110 * (1 - decay)) / 1000
      const edge = Math.max(0, d.width - d.size)
      const bounce = !follow && !manual
      if (pet.anchorX <= 0 && vx < 0) { vx = bounce ? Math.abs(vx) : 0; pet.lookRight = true }
      else if (pet.anchorX >= edge && vx > 0) { vx = bounce ? -Math.abs(vx) : 0; pet.lookRight = false }
      else if (Math.abs(vx) > 2) pet.lookRight = vx > 0
    }
    let jumpProgress = 0
    if (jump) {
      const maxY = Math.max(0, d.height - d.spriteHeight)
      jump.from = Math.min(jump.from, maxY); jump.to = Math.min(jump.to, maxY)
      jump.height = Math.min(jump.height, jump.from, jump.to)
      jumpProgress = Math.min(1, (elapsed - jump.start) / jump.duration)
      const t = jumpProgress, blend = t * t * (3 - 2 * t)
      if (jump.toX !== null) pet.anchorX = jump.fromX + (jump.toX - jump.fromX) * blend
      pet.anchorY = jump.from + (jump.to - jump.from) * blend - 4 * jump.height * t * (1 - t)
      if (t === 1) { pet.anchorY = jump.to; currentSurface = jump.targetSurface; jump = null }
    }
    clampToBounds(d)
    if (mode !== 'free' && !jump && !fall && !drag) reconcileSurface(d)
    if (fall) updateFall(dt, d)
    if (roamTargetX !== null && !manual && Math.abs(roamTargetX - pet.anchorX) < Math.max(3, d.size * .12 + 2)) {
      pet.anchorX = Math.max(0, Math.min(roamTargetX, d.width - d.size))
      roamTargetX = null
      vx = 0
      restUntil = elapsed + 1400 + random() * 2100
      autoAction = nextNativeAction()
      ambientLook = null
    } else if (autoAction && elapsed >= restUntil) {
      autoAction = null
      ambientLook = Math.floor(random() * 16)
      restUntil = 0
      nextRoamAt = elapsed + 650 + random() * 900
      nextLookAt = elapsed + 300 + random() * 400
    } else if (ambientLook !== null && elapsed >= nextLookAt) {
      ambientLook = (ambientLook + (random() < .5 ? 15 : 1)) % 16
      nextLookAt = elapsed + 350 + random() * 500
    }
    setState(jump || fall ? 'jumping' : drag ? (pet.lookRight ? 'right' : 'left')
      : manual?.name || autoAction || (Math.abs(vx) > 2 ? (pet.lookRight ? 'right' : 'left') : 'idle'))
    // Explicit previews play a full cycle even when the viewport prevents movement.
    poseElapsed += dt * (walking(state) && !manual ? Math.min(1, Math.abs(vx) / moveSpeed) : 1)
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
    if (jump || fall) {
      if (name === 'jumping') return false
      jump = null
      fall = null
      holdAirborneAction = true
    }
    if (name === 'jumping' && !beginJump()) return false
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
    if (profile?.version === 2 && state === 'idle' && !manual && !drag && !jump && !fall) {
      let direction = null
      if (pointer && config().follow_mouse) {
        const dx = pointer.x - pet.anchorX - d.size / 2
        const dy = pointer.y - pet.anchorY - d.spriteHeight / 2
        if (Math.hypot(dx, dy) > 12) direction = Math.round(((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 8)) % 16
      } else if (config().auto_roam) direction = ambientLook
      if (direction !== null) {
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
    manual = null; jump = null; fall = null; currentSurface = null; pointer = null; tracking = false; gazeLocked = false; vx = 0
    holdAirborneAction = false
    roamTargetX = null; autoAction = null; ambientLook = null; restUntil = 0
    state = 'idle'; pose = 0; poseElapsed = 0; nextHopAt = elapsed + 8000 + random() * 9000; nextRoamAt = elapsed + 1800
    pet.anchorX = initialPet.anchorX; pet.anchorY = initialPet.anchorY
    clampToBounds(); options.onUpdate?.()
  }
  return {
    pet, config, start, stop, clampToBounds, renderState, resetPose, playAction,
    playBehavior: name => name === 'rest' ? playAction('idle') : false,
    updateConfig(next) {
      const previousRange = localConfig.activity_range || 'surfaces'
      localConfig = next
      if (previousRange !== activityRange()) {
        jump = null; fall = null; currentSurface = null; roamTargetX = null; autoAction = null; restUntil = 0
        holdAirborneAction = false
        nextRoamAt = elapsed + 300
      }
      clampToBounds()
    },
    debugState: () => ({ action: state, surface: fall ? 'air' : currentSurface?.id || activityRange(), state: drag ? 'drag' : fall ? 'fall' : state, poseIndex: pose,
      vx, x: pet.anchorX, y: pet.anchorY, pointerReceived: Boolean(pointer),
      followMouse: Boolean(config().follow_mouse), jumping: Boolean(jump), falling: Boolean(fall),
      gazeRadius: gazeRadius(dimensions()), gazeLocked,
      verticalThreshold: verticalThreshold(dimensions()),
      targetY: jump?.to ?? (pointer && config().follow_mouse ? pointerTargetY(dimensions()) : pet.anchorY) }),
    handlePointerMove(point) { pointer = point },
    handlePointerLeave() { pointer = null; gazeLocked = false; nextHopAt = elapsed + 8000 + random() * 9000 },
    startDrag(point) {
      if (!point) return
      jump = null; fall = null; currentSurface = null; manual = null; autoAction = null; roamTargetX = null
      holdAirborneAction = false
      vx = 0; tracking = false; gazeLocked = false
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
      drag = null; pointer = null; currentSurface = null; restUntil = elapsed + 400
      nextHopAt = elapsed + 8000 + random() * 9000; nextRoamAt = restUntil + 300
      clampToBounds(); options.onUpdate?.()
    },
    shouldSuppressClick: () => Date.now() < suppressUntil,
    celebrate: () => playAction('waving'),
  }
}
