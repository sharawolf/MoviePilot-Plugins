import assert from 'node:assert/strict'
import test from 'node:test'
import { createPetLibraryController } from '../../../plugins.v3/agentmascot/src/pet-library-controller.js'
import { createMascotRuntime, cloneConfig, normalizeConfig, petAssetUrls, applyMascotImage } from '../../../plugins.v3/agentmascot/runtime/mascot-runtime.js'
import { actionGroups } from '../../../plugins.v3/agentmascot/src/actions.js'

const pet = { id: `pet_${'a'.repeat(32)}`, name: 'Sample', version: 2, rows: 11, icon: '', sprite_url: 'data:image/png;base64,test' }
const envelope = data => ({ success: true, message: '', data })
const file = () => new File(['zip bytes'], 'sample.zip', { type: 'application/zip' })

test('ZIP preview is separate from saving; duplicate clicks submit only once', async () => {
  const paths = [], imported = []
  let release
  const controller = createPetLibraryController({ pluginId: 'AgentMascot_clone',
    api: { post: async (path, form) => {
      assert.ok(form instanceof FormData)
      assert.equal(form.get('file').name, 'sample.zip')
      paths.push(path)
      if (path.endsWith('/import')) await new Promise(resolve => { release = resolve })
      return envelope({ pet })
    } }, onImported: value => imported.push(value) })
  assert.ok(await controller.inspect(file()))
  assert.equal(imported.length, 0)
  assert.equal(controller.state.candidate.id, pet.id)
  const first = controller.save()
  assert.equal(await controller.save(), false)
  release(); await first
  assert.equal(paths.length, 2)
  assert.equal(paths[0], 'plugin/AgentMascot_clone/pets/inspect')
  assert.equal(imported.length, 1)
  assert.equal(controller.state.candidate, null)
})

test('failed imports retain the validated candidate; leaving ignores late results', async () => {
  let fail = false, release, imported = 0
  const controller = createPetLibraryController({ pluginId: 'AgentMascot',
    api: { post: async path => {
      if (path.endsWith('/import')) {
        if (fail) throw new Error('offline')
        await new Promise(resolve => { release = resolve })
      }
      return envelope({ pet })
    } }, onImported: () => imported++ })
  await controller.inspect(file())
  fail = true
  assert.equal(await controller.save(), false)
  assert.equal(controller.state.candidate.id, pet.id)
  fail = false
  const request = controller.save()
  controller.suspend(); release(); await request
  assert.equal(imported, 0)
})

test('delete calls the exact instance and removes only after acknowledgement', async () => {
  let reject = true, removed = ''
  const controller = createPetLibraryController({ pluginId: 'AgentMascot_clone',
    api: { delete: async path => {
      assert.equal(path, `plugin/AgentMascot_clone/pets/${pet.id}`)
      return reject ? { success: false, message: '正在使用', data: null } : envelope(null)
    } }, onRemoved: id => { removed = id } })
  controller.state.removeId = pet.id
  assert.equal(await controller.remove(), false)
  assert.equal(removed, '')
  reject = false
  assert.equal(await controller.remove(), true)
  assert.equal(removed, pet.id)
})

function runtimeHarness(version = 2, initialPet) {
  let config = { enabled: true, mascot: pet.id, scale: 1, speed: 1, auto_roam: false,
    follow_mouse: true, _pet: { ...pet, version, rows: version === 2 ? 11 : 9 } }
  let serial = 0
  let bounds = { width: 640, height: 360 }
  const frames = new Map()
  const runtime = createMascotRuntime({ getConfig: () => config, bounds: () => bounds, initialPet,
    scheduler: { requestAnimationFrame: cb => { frames.set(++serial, cb); return serial }, cancelAnimationFrame: id => frames.delete(id) } })
  return { runtime, frames, config, update(next) { config = next; runtime.updateConfig(next) },
    resize(next) { bounds = next; runtime.clampToBounds() },
    tick(time) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(time) } }
}

test('v2 gaze picks cardinal atlas cells; v1 stays inside its nine rows', () => {
  const { runtime } = runtimeHarness()
  const view = runtime.renderState()
  const center = { x: view.left + view.size / 2, y: view.top + view.height / 2 }
  for (const [dx, dy, row, column] of [[0,-60,9,0], [60,0,9,4], [0,60,10,0], [-60,0,10,4]]) {
    runtime.handlePointerMove({ x: center.x + dx, y: center.y + dy })
    const frame = runtime.renderState()
    assert.deepEqual([frame.row, frame.column], [row, column])
    assert.equal(frame.flipX, 1)
    assert.equal(frame.height / frame.size, 208 / 192)
  }
  const legacy = runtimeHarness(1).runtime
  legacy.handlePointerMove({ x:100, y:0 })
  assert.equal(legacy.renderState().row, 0)
})

test('native pet actions animate correct rows and release RAF on stop', () => {
  const h = runtimeHarness()
  h.runtime.start(); h.runtime.start()
  assert.equal(h.frames.size, 1)
  h.runtime.playAction('working')
  assert.equal(h.runtime.renderState().row, 7)
  for (let i = 1; i <= 10; i++) h.tick(i * 40)
  assert.ok(h.runtime.renderState().column > 0)
  assert.equal(h.runtime.playAction('climbWall'), false)
  assert.equal(actionGroups(pet.id, 'behavior').length, 0)
  assert.equal(actionGroups(pet.id).flatMap(group => group.items).length, 9)
  h.runtime.stop()
  assert.equal(h.frames.size, 0)
})

test('repeated jump requests preserve the original landing height until the arc finishes', () => {
  const h = runtimeHarness(2, { anchorX: 180, anchorY: 400 })
  h.resize({ width: 1200, height: 720 })
  h.runtime.start()
  let step = 0
  for (let cycle = 0; cycle < 20; cycle++) {
    assert.equal(h.runtime.playAction('jumping'), true)
    for (let tick = 0; tick < 6; tick++) h.tick(step++ * 40)
    const landingY = h.runtime.debugState().targetY
    assert.equal(h.runtime.playAction('jumping'), false)
    assert.equal(h.runtime.debugState().targetY, landingY)
    for (let tick = 0; tick < 45; tick++) h.tick(step++ * 40)
    assert.equal(h.runtime.renderState().top, 400)
  }
  h.runtime.stop()
  assert.equal(h.frames.size, 0)
})

test('nearby pointers keep all gaze directions across animation frames and autonomous hop deadlines', () => {
  for (const scale of [.6, 1, 2, 4]) {
    const h = runtimeHarness(2, { anchorX: 500, anchorY: 500 })
    h.resize({ width: 2200, height: 1400 })
    h.update({ ...h.config, scale, auto_roam: true })
    const view = h.runtime.renderState()
    const radius = Math.max(32, view.height / 2)
    const center = { x: view.left + view.size / 2, y: view.top + view.height / 2 }
    h.runtime.start()
    let step = 0
    for (let direction = 0; direction < 16; direction++) {
      const angle = direction * Math.PI / 8
      h.runtime.handlePointerMove({ x: center.x + Math.sin(angle) * radius * .8,
        y: center.y - Math.cos(angle) * radius * .8 })
      for (let tick = 0; tick < 40; tick++) {
        h.tick(step++ * 1000 / 60)
        const frame = h.runtime.renderState()
        assert.deepEqual([frame.left, frame.top], [500, 500], `scale=${scale}, direction=${direction}`)
        assert.deepEqual([frame.row, frame.column], [9 + Math.floor(direction / 8), direction % 8])
      }
    }
    h.runtime.stop()
  }
})

test('vertical chasing begins beyond the gaze buffer and returns to gaze after landing', () => {
  const h = runtimeHarness(2, { anchorX: 300, anchorY: 300 })
  h.resize({ width: 1200, height: 900 })
  h.update({ ...h.config, scale: 2, auto_roam: true })
  h.runtime.start()
  let step = 0
  const advance = count => { for (let i = 0; i < count; i++) h.tick(step++ * 1000 / 60) }
  h.runtime.handlePointerMove({ x: 396, y: 404 - 80 })
  advance(60)
  assert.equal(h.runtime.renderState().top, 300)
  for (let i = 0; i < 40; i++) {
    h.runtime.handlePointerMove({ x: 396, y: 404 - 104 + (i % 2 ? -3 : 3) })
    advance(1)
    assert.equal(h.runtime.debugState().jumping, false)
  }
  h.runtime.handlePointerMove({ x: 396, y: 404 - 160 })
  advance(1)
  assert.equal(h.runtime.debugState().jumping, true)
  advance(90)
  assert.equal(h.runtime.renderState().top, 140)
  h.runtime.handlePointerMove({ x: 396 + 80, y: 244 })
  advance(90)
  assert.deepEqual([h.runtime.renderState().row, h.runtime.renderState().column], [9, 4])
  h.runtime.handlePointerMove({ x: 396, y: 244 + 200 })
  advance(90)
  assert.equal(h.runtime.renderState().top, 340)
  h.runtime.stop()
})

test('horizontal chasing slows down inside the gaze zone and keeps looking at the pointer', () => {
  const h = runtimeHarness(2, { anchorX: 300, anchorY: 300 })
  h.resize({ width: 1200, height: 900 })
  h.update({ ...h.config, scale: 2, speed: 2, auto_roam: true })
  h.runtime.handlePointerMove({ x: 800, y: 404 })
  h.runtime.start()
  for (let i = 0; i <= 360; i++) h.tick(i * 1000 / 60)
  const view = h.runtime.renderState()
  assert.ok(view.left > 300)
  assert.ok(800 - view.left - view.size / 2 < 104)
  assert.equal(view.top, 300)
  assert.deepEqual([view.row, view.column], [9, 4])
  assert.equal(h.runtime.debugState().gazeLocked, true)
  assert.ok(Math.abs(h.runtime.debugState().vx) < 1)
  h.runtime.stop()
})

test('drag suppresses activation and custom config never serializes its image payload', () => {
  const h = runtimeHarness()
  h.runtime.startDrag({x:100,y:100})
  h.runtime.moveDrag({x:130,y:120}, 30)
  h.runtime.endDrag()
  assert.equal(h.runtime.shouldSuppressClick(), true)
  assert.equal(normalizeConfig(h.config).mascot, pet.id)
  assert.equal(cloneConfig(h.config)._pet, undefined)
  assert.equal(cloneConfig(h.config).mascot, pet.id)
  assert.equal(petAssetUrls({ ...pet, sprite_url: '/api/v1/image' }, { location: { origin:'https://host.test' }, document: { querySelector:()=>({href:'https://host.test/mp/'}) } }).sprite_url, 'https://host.test/mp/api/v1/image')
})

test('imported pet keeps its initial and dropped height across animation and config polling', () => {
  const h = runtimeHarness(2, { anchorX: 180, anchorY: 180 })
  assert.equal(h.runtime.renderState().top, 180)
  h.runtime.startDrag({ x: 200, y: 200 })
  h.runtime.moveDrag({ x: 230, y: 100 }, 30)
  h.runtime.endDrag()
  assert.equal(h.runtime.renderState().top, 80)
  assert.equal(h.runtime.renderState().left, 210)
  h.update({ ...h.config, auto_roam: true, follow_mouse: false })
  h.runtime.start()
  for (let i = 1; i <= 120; i++) h.tick(i * 40)
  assert.equal(h.runtime.renderState().top, 80)
  assert.ok(h.runtime.renderState().left > 210)
  h.update({ ...h.config, scale: 1.5 })
  assert.equal(h.runtime.renderState().top, 80)
  h.runtime.stop()
})

test('viewport changes only constrain out-of-bounds coordinates and reset restores the initial position', () => {
  const h = runtimeHarness(1, { anchorX: 180, anchorY: 180 })
  h.resize({ width: 800, height: 600 })
  assert.equal(h.runtime.renderState().top, 180)
  h.resize({ width: 240, height: 180 })
  const small = h.runtime.renderState()
  assert.ok(small.left >= 0 && small.left + small.size <= 240)
  assert.ok(small.top >= 0 && small.top + small.height <= 180)
  h.resize({ width: 800, height: 600 })
  assert.equal(h.runtime.renderState().top, small.top)
  h.runtime.resetPose()
  assert.equal(h.runtime.renderState().top, 180)
  assert.equal(h.runtime.renderState().left, 180)
})

test('small preview follows vertically and a clamped pointer does not cause repeated edge jumps', () => {
  const h = runtimeHarness(2, { anchorX: 100, anchorY: 100 })
  h.resize({ width: 600, height: 320 })
  h.update({ ...h.config, scale: 2, speed: 2, auto_roam: false })
  h.runtime.handlePointerMove({ x: 196, y: 0 })
  h.runtime.start()
  for (let i = 0; i <= 90; i++) h.tick(i * 1000 / 60)
  assert.equal(h.runtime.renderState().top, 0)
  h.runtime.handlePointerMove({ x: 196, y: 320 })
  for (let i = 91; i <= 300; i++) h.tick(i * 1000 / 60)
  assert.equal(h.runtime.renderState().top, 112)
  assert.equal(h.runtime.debugState().jumping, false)
  h.runtime.stop()
})

test('imported frame maps play extra action frames and replace absent actions and gaze', () => {
  const h = runtimeHarness()
  const frame_map = Array.from({ length: 11 }, () => [[0, 3]])
  frame_map[0] = Array.from({ length: 7 }, (_, column) => [0, column])
  frame_map[9] = Array.from({ length: 8 }, () => [0, 3])
  h.update({ ...h.config, _pet: { ...h.config._pet, frame_map } })
  h.runtime.playAction('idle')
  h.runtime.start()
  for (let i = 1; i <= 32; i++) h.tick(i * 24)
  assert.equal(h.runtime.renderState().column, 6)
  h.runtime.playAction('working')
  assert.deepEqual([h.runtime.renderState().row, h.runtime.renderState().column], [0, 3])
  h.runtime.resetPose()
  const view = h.runtime.renderState()
  h.runtime.handlePointerMove({ x: view.left + view.size / 2, y: view.top - 60 })
  assert.deepEqual([h.runtime.renderState().row, h.runtime.renderState().column], [0, 3])
  h.runtime.stop()
})

test('running cadence follows speed and travel is stable across display refresh rates', () => {
  function run(speed, hz) {
    const h = runtimeHarness()
    h.resize({ width: 2400, height: 800 })
    h.update({ ...h.config, speed, auto_roam: true, follow_mouse: false })
    h.runtime.start()
    let changes = 0, last = -1
    for (let i = 0; i <= hz * 2; i++) {
      h.tick(i * 1000 / hz)
      const view = h.runtime.renderState()
      if (view.column !== last) changes++
      last = view.column
    }
    h.runtime.stop()
    return { x: h.runtime.pet.anchorX, changes }
  }
  const slow = run(1, 60), fast = run(2, 60)
  assert.ok(slow.changes >= 20, 'running no longer holds every frame for 120 ms')
  assert.ok(fast.changes > slow.changes * 1.7)
  assert.ok(fast.x - 80 > (slow.x - 80) * 1.9)
  for (const hz of [30, 120]) assert.ok(Math.abs(run(1, hz).x - slow.x) < .1)
})

test('following decelerates smoothly and small pointer changes do not toggle running', () => {
  const h = runtimeHarness()
  h.runtime.start()
  for (let i = 0; i < 90; i++) {
    const view = h.runtime.renderState()
    h.runtime.handlePointerMove({ x: view.left + view.size / 2 + 96 + (i % 2 ? -2 : 2), y: view.top + view.height / 2 })
    h.tick(i * 1000 / 60)
    if (i > 30) assert.ok(h.runtime.debugState().vx > 60)
  }
  const view = h.runtime.renderState(), before = h.runtime.debugState().vx
  h.runtime.handlePointerMove({ x: view.left + view.size / 2, y: view.top + view.height / 2 })
  h.tick(1500)
  assert.ok(h.runtime.debugState().vx > 0 && h.runtime.debugState().vx < before)
  for (let i = 91; i <= 150; i++) h.tick(i * 1000 / 60)
  assert.ok(Math.abs(h.runtime.debugState().vx) < 1)
  h.runtime.stop()
})

test('jump action follows an arc and lands at its launch height', () => {
  const h = runtimeHarness(1, { anchorX: 100, anchorY: 180 })
  h.runtime.playAction('jump')
  h.runtime.start()
  const heights = [], columns = []
  for (let i = 0; i <= 54; i++) {
    h.tick(i * 1000 / 60)
    const view = h.runtime.renderState()
    heights.push(view.top)
    if (view.row === 4) columns.push(view.column)
  }
  assert.ok(Math.min(...heights) < 130)
  assert.equal(heights.at(-1), 180)
  assert.ok(columns.includes(0) && columns.includes(4))
  assert.ok(columns.every((value, index) => index === 0 || value >= columns[index - 1]))
  h.runtime.stop()
})

test('mouse following can hop upward and downward without leaving the viewport', () => {
  const h = runtimeHarness()
  h.runtime.start()
  const first = h.runtime.renderState()
  h.runtime.handlePointerMove({ x: first.left + first.size / 2, y: 40 + first.height / 2 })
  for (let i = 0; i <= 90; i++) {
    h.tick(i * 1000 / 60)
    assert.ok(h.runtime.renderState().top >= 0)
  }
  assert.equal(h.runtime.renderState().top, 40)
  h.runtime.handlePointerMove({ x: first.left + first.size / 2, y: 240 + first.height / 2 })
  for (let i = 91; i <= 180; i++) {
    h.tick(i * 1000 / 60)
    const view = h.runtime.renderState()
    assert.ok(view.top >= 0 && view.top + view.height <= 360)
  }
  assert.equal(h.runtime.renderState().top, 240)
  h.runtime.stop()
})

test('autonomous roaming continues with following disabled and includes a hop', () => {
  const h = runtimeHarness()
  h.resize({ width: 2400, height: 600 })
  h.update({ ...h.config, auto_roam: true, follow_mouse: false })
  h.runtime.handlePointerMove({ x: 0, y: 0 })
  h.runtime.start()
  let before = 0, after = 0, airborne = false
  for (let i = 0; i <= 450; i++) {
    h.tick(i * 1000 / 60)
    if (i === 280) before = h.runtime.pet.anchorX
    if (i === 320) after = h.runtime.pet.anchorX
    if (h.runtime.pet.anchorY < 170) airborne = true
  }
  assert.ok(after - before > 30, 'no forced stop after 4.5 seconds')
  assert.ok(airborne)
  assert.equal(h.runtime.pet.anchorY, 180)
  h.runtime.stop()
})

test('dragging cancels a jump and pausing cannot advance a pending animation', () => {
  const h = runtimeHarness()
  h.runtime.playAction('jumping'); h.runtime.start()
  for (let i = 0; i < 10; i++) h.tick(i * 16)
  const view = h.runtime.renderState()
  h.runtime.startDrag({ x: view.left + 10, y: view.top + 10 })
  h.runtime.moveDrag({ x: 130, y: 90 }, 10); h.runtime.endDrag()
  for (let i = 10; i < 60; i++) h.tick(i * 16)
  assert.equal(h.runtime.pet.anchorY, 80)
  h.runtime.playAction('jumping'); h.tick(1000); h.runtime.stop()
  const stopped = h.runtime.renderState()
  assert.equal(h.frames.size, 0)
  assert.equal(h.runtime.renderState().top, stopped.top)
  h.runtime.start(); h.tick(60000)
  assert.ok(Math.abs(h.runtime.renderState().top - stopped.top) < 10)
  h.runtime.stop()
})

test('atlas rendering reuses the image and changes only the crop transform', () => {
  let srcWrites = 0, styleWrites = 0
  const styles = {}, img = { set src(_value) { srcWrites++ },
    style: new Proxy(styles, { set(target, key, value) { styleWrites++; target[key] = value; return true } }) }
  const h = runtimeHarness()
  const first = h.runtime.renderState()
  applyMascotImage(img, first)
  const writes = styleWrites
  for (let i = 0; i < 120; i++) applyMascotImage(img, h.runtime.renderState())
  assert.equal(srcWrites, 1)
  assert.equal(styleWrites, writes)
  h.runtime.playAction('working')
  applyMascotImage(img, h.runtime.renderState())
  assert.equal(srcWrites, 1)
  assert.equal(styleWrites, writes + 1)
  assert.match(styles.transform, /translate3d/)
  applyMascotImage(img, { frame: 'builtin-frame' })
  assert.equal(styles.transform, 'none')
  assert.equal(styles.position, 'static')
})

const nativeActions = { idle: [0, 6], right: [1, 8], left: [2, 8], waving: [3, 4],
  jumping: [4, 5], failed: [5, 8], waiting: [6, 6], working: [7, 6], review: [8, 6] }

test('every v1/v2 action completes its frame cycle at speed limits and 30/60/120 Hz, including at an edge', () => {
  for (const version of [1, 2]) for (const speed of [.4, 1, 2]) for (const hz of [30, 60, 120]) {
    for (const [action, [row, count]] of Object.entries(nativeActions)) {
      const h = runtimeHarness(version, { anchorX: action === 'left' ? 0 : action === 'right' ? 544 : 250, anchorY: 180 })
      h.update({ ...h.config, speed, auto_roam: false, follow_mouse: false })
      assert.equal(h.runtime.playAction(action), true)
      h.runtime.start()
      const seen = new Set([h.runtime.renderState().column])
      for (let time = 0; time <= 2800; time += 1000 / hz) {
        h.tick(time)
        const view = h.runtime.renderState()
        assert.ok(view.left >= 0 && view.left + view.size <= 640)
        assert.ok(view.top >= 0 && view.top + view.height <= 360)
        if (view.row === row) seen.add(view.column)
      }
      assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i),
        `version=${version}, speed=${speed}, hz=${hz}, action=${action}`)
      assert.equal(h.runtime.renderState().row, 0, 'one-shot action returns to idle')
      h.runtime.stop()
    }
  }
})

test('all nine actions can interrupt one another without retaining the previous row or pose', () => {
  for (const version of [1, 2]) for (const from of Object.keys(nativeActions)) {
    for (const [to, [row]] of Object.entries(nativeActions)) {
      const h = runtimeHarness(version, { anchorX: 250, anchorY: 180 })
      h.update({ ...h.config, auto_roam: false, follow_mouse: false })
      h.runtime.playAction(from); h.runtime.start()
      for (let i = 0; i < 12; i++) h.tick(i * 16)
      h.runtime.playAction(to)
      assert.deepEqual([h.runtime.renderState().row, h.runtime.renderState().column], [row, 0], `${version}: ${from} -> ${to}`)
      for (let i = 12; i < 240; i++) h.tick(i * 16)
      assert.equal(h.runtime.renderState().row, 0, `${version}: ${from} -> ${to} finishes`)
      assert.equal(h.runtime.debugState().jumping, false)
      h.runtime.stop()
    }
  }
})

test('every action plays the complete imported sparse frame map, including missing-action fallbacks', () => {
  const frame_map = Array.from({ length: 11 }, (_, row) => row < 9
    ? [[row, 1], [row, 3], [row, 6]] : Array.from({ length: 8 }, () => [0, 1]))
  frame_map[5] = frame_map[0]
  for (const [action, [row]] of Object.entries(nativeActions)) {
    const h = runtimeHarness(2, { anchorX: 250, anchorY: 180 })
    h.update({ ...h.config, follow_mouse: false, auto_roam: false,
      _pet: { ...h.config._pet, frame_map } })
    h.runtime.playAction(action); h.runtime.start()
    const seen = new Set()
    for (let i = 0; i < 200; i++) {
      if (h.runtime.debugState().action === action) {
        const frame = h.runtime.renderState()
        seen.add(`${frame.row},${frame.column}`)
      }
      h.tick(i * 1000 / 120)
    }
    assert.deepEqual([...seen], frame_map[row].map(cell => cell.join(',')), action)
    h.runtime.stop()
  }
})

test('following a pointer at any viewport corner settles instead of bouncing between run directions', () => {
  for (const scale of [.6, 1, 2, 4]) for (const [x, y] of [[0, 0], [0, 599], [799, 0], [799, 599]]) {
    const h = runtimeHarness(2, { anchorX: 200, anchorY: 180 })
    h.resize({ width: 800, height: 600 })
    h.update({ ...h.config, scale, speed: 2, auto_roam: true })
    h.runtime.handlePointerMove({ x, y }); h.runtime.start()
    const positions = []
    for (let i = 0; i < 1200; i++) {
      h.tick(i * 1000 / 60)
      if (i >= 1100) {
        const state = h.runtime.debugState()
        assert.equal(state.action, 'idle', `scale=${scale}, corner=${x},${y}`)
        assert.equal(state.jumping, false)
        assert.ok(Math.abs(state.vx) < 1)
        positions.push(state.x)
      }
    }
    assert.ok(Math.max(...positions) - Math.min(...positions) < .1)
    h.runtime.stop()
  }
})
