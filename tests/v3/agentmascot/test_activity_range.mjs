import assert from 'node:assert/strict'
import test from 'node:test'
import { createCodexPetRuntime } from '../../../plugins.v3/agentmascot/runtime/codex-pet.js'
import { e as createBuiltinRuntime, f as buildSurfaceLanes, j as buildDomSurfaces } from '../../../plugins.v3/agentmascot/runtime/runtime-BCybTabx.js'

/** 创建由测试逐帧推进的动画调度器。 */
function frameHarness() {
  let serial = 0, time = 0
  const frames = new Map(), intervals = new Map()
  const scheduler = {
    requestAnimationFrame(callback) { const id = ++serial; frames.set(id, callback); return id },
    cancelAnimationFrame(id) { frames.delete(id) },
    setInterval(callback) { const id = ++serial; intervals.set(id, callback); return id },
    clearInterval(id) { intervals.delete(id) },
  }
  return {
    scheduler,
    tick(step = 40) {
      const entry = frames.entries().next().value
      assert.ok(entry, 'animation frame remains scheduled')
      frames.delete(entry[0])
      time += step
      entry[1](time)
    },
    stop(runtime) { runtime.stop(); assert.equal(frames.size, 0) },
  }
}

/** 创建消费可站矩形的内置角色运行器。 */
function builtinHarness({ range = 'surfaces', surfaces = [], x = 260, y = 260, height = 700, random = () => 0.5 } = {}) {
  const clock = frameHarness()
  let surfaceReads = 0
  const runtime = createBuiltinRuntime({
    config: { mascot: 'kurisu', activity_range: range, auto_roam: false, follow_mouse: false },
    bounds: () => ({ width: 900, height }),
    initialPet: { anchorX: x, anchorY: y, lookRight: true },
    getSurfaceLanes: context => range === 'free'
      ? buildSurfaceLanes(context)
      : buildSurfaceLanes(context, { ratios: [], extraAnchors: surfaces.map(surface => surface.top) }),
    getSurfaces: () => { surfaceReads++; return surfaces },
    random,
    scheduler: clock.scheduler,
  })
  return { ...clock, runtime, surfaceReads: () => surfaceReads }
}

/** 创建消费可站矩形的导入角色运行器。 */
function importedHarness({ range = 'surfaces', surfaces = [], x = 200, y = 156, height = 700, autoRoam = false, random = () => 0.5 } = {}) {
  const clock = frameHarness()
  let surfaceReads = 0
  const runtime = createCodexPetRuntime({
    config: { activity_range: range, auto_roam: autoRoam, follow_mouse: false },
    bounds: () => ({ width: 900, height }),
    initialPet: { anchorX: x, anchorY: y },
    getSurfaces: () => { surfaceReads++; return surfaces },
    random,
    scheduler: clock.scheduler,
  })
  return { ...clock, runtime, surfaceReads: () => surfaceReads }
}

/** 创建满足 DOM 几何接口的候选元素。 */
function domElement(id, rect) {
  return {
    id,
    getBoundingClientRect: () => rect,
    getAttribute: () => null,
    hasAttribute: () => false,
    contains: () => false,
  }
}

test('DOM platform scan rejects short, narrow and covered surfaces, then keeps the viewport floor', () => {
  const short = domElement('short', { left: 0, right: 300, top: 80, bottom: 180, width: 300, height: 100 })
  const narrow = domElement('narrow', { left: 0, right: 110, top: 150, bottom: 250, width: 110, height: 100 })
  const covered = domElement('covered', { left: 0, right: 300, top: 180, bottom: 280, width: 300, height: 100 })
  const visible = domElement('visible', { left: 40, right: 360, top: 170, bottom: 320, width: 320, height: 150 })
  const platforms = buildDomSurfaces({ bounds: { width: 500, height: 700 }, size: 96 },
    [short, narrow, covered, visible], {
      petHeight: 104,
      isTopVisible: element => element === visible,
    })
  assert.deepEqual(platforms.map(surface => surface.id), ['element:40:360:170', 'floor'])
})

test('built-in mascot walks off a card and lands on the first lower platform', () => {
  const h = builtinHarness({
    surfaces: [
      { id: 'upper', left: 100, right: 440, top: 260 },
      { id: 'lower', left: 0, right: 600, top: 420 },
    ],
    random: () => 0.25,
  })
  h.runtime.start()
  assert.equal(h.runtime.debugState().platform, 'upper', JSON.stringify({
    pet: h.runtime.pet, pose: h.runtime.currentPose(), debug: h.runtime.debugState(),
  }))
  h.runtime.playBehavior('goWall', { timestamp: 0 })
  for (let i = 0; i < 400 && h.runtime.debugState().platform !== 'lower'; i++) h.tick()
  assert.equal(h.runtime.debugState().platform, 'lower')
  assert.equal(h.runtime.pet.anchorY, 420)
  h.stop(h.runtime)
})

test('built-in mascot hops to a nearby higher platform', () => {
  const h = builtinHarness({
    x: 260,
    y: 320,
    surfaces: [
      { id: 'upper', left: 120, right: 500, top: 260 },
      { id: 'lower', left: 80, right: 520, top: 320 },
    ],
    random: () => 0.25,
  })
  h.runtime.start()
  assert.equal(h.runtime.debugState().platform, 'lower', JSON.stringify({
    pet: h.runtime.pet, pose: h.runtime.currentPose(), debug: h.runtime.debugState(),
  }))
  assert.equal(h.runtime.playBehavior('leap', { timestamp: 0 }).applied, true)
  for (let i = 0; i < 100 && h.runtime.debugState().platform !== 'upper'; i++) h.tick()
  assert.equal(h.runtime.debugState().platform, 'upper')
  assert.equal(h.runtime.pet.anchorY, 260)
  h.stop(h.runtime)
})

test('floor mode stays at the viewport bottom and never reads page elements', () => {
  const h = builtinHarness({ range: 'floor', x: 260, y: 220, surfaces: [] })
  h.runtime.start()
  for (let i = 0; i < 100 && h.runtime.debugState().platform !== 'floor'; i++) h.tick()
  assert.equal(h.runtime.debugState().platform, 'floor')
  assert.equal(h.runtime.pet.anchorY, 682)
  assert.equal(h.runtime.playBehavior('climbWall', { timestamp: 5000 }).applied, false)
  assert.equal(h.surfaceReads(), 0)
  h.stop(h.runtime)
})

test('free mode never reads page elements and retains the built-in wall behavior', () => {
  const h = builtinHarness({ range: 'free', y: 260 })
  h.runtime.start()
  h.runtime.playBehavior('goWall', { timestamp: 0 })
  assert.equal(h.runtime.debugState().surface, 'ground')
  for (let i = 0; i < 200 && h.runtime.debugState().surface !== 'wall'; i++) h.tick()
  assert.equal(h.runtime.debugState().surface, 'wall')
  assert.equal(h.surfaceReads(), 0)
  h.stop(h.runtime)
})

test('imported mascot falls from a card onto the nearest lower surface', () => {
  const h = importedHarness({
    x: 260,
    y: 156,
    autoRoam: true,
    random: () => 0,
    surfaces: [
      { id: 'upper', left: 100, right: 500, top: 260, floor: false },
      { id: 'lower', left: 0, right: 600, top: 420, floor: false },
      { id: 'floor', left: 0, right: 900, top: 700, floor: true },
    ],
  })
  h.runtime.start()
  for (let i = 0; i < 500 && h.runtime.debugState().surface !== 'lower'; i++) h.tick()
  assert.equal(h.runtime.debugState().surface, 'lower')
  assert.equal(h.runtime.pet.anchorY, 420 - 208 / 192 * 96)
  h.stop(h.runtime)
})

test('floor and free modes skip DOM surface reads in imported mascots', () => {
  for (const range of ['floor', 'free']) {
    const h = importedHarness({
      range,
      x: 200,
      y: 180,
      surfaces: [],
    })
    h.runtime.start()
    for (let i = 0; i < 100; i++) h.tick()
    assert.equal(h.surfaceReads(), 0, `${range} mode does not scan elements`)
    if (range === 'floor') assert.equal(h.runtime.debugState().surface, 'floor')
    else assert.equal(h.runtime.pet.anchorY, 180)
    h.stop(h.runtime)
  }
})

test('imported mascot cycles through every native action during natural roaming', () => {
  const h = importedHarness({ range: 'free', x: 180, y: 180, autoRoam: true, random: () => 0.5 })
  const actions = new Set()
  h.runtime.start()
  for (let i = 0; i < 3000; i++) {
    h.tick()
    actions.add(h.runtime.debugState().action)
  }
  for (const action of ['waving', 'working', 'review', 'waiting', 'failed']) assert.ok(actions.has(action), `${action}: ${[...actions].join(',')}`)
  h.stop(h.runtime)
})

test('built-in rest rotation includes its complete automatic action set', () => {
  const h = builtinHarness({ range: 'floor', y: 682 })
  const actions = new Set()
  for (let i = 0; i < 20; i++) {
    h.runtime.playBehavior('rest', { timestamp: i * 5000 })
    actions.add(h.runtime.debugState().action)
  }
  for (const action of ['crawl', 'pullOut', 'cheer', 'spinCelebrate']) assert.ok(actions.has(action), action)
  h.runtime.stop()
})
