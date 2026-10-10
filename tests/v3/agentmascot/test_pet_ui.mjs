import assert from 'node:assert/strict'
import test from 'node:test'
import { createPetLibraryController } from '../../../plugins.v3/agentmascot/src/pet-library-controller.js'
import { createMascotRuntime, cloneConfig, normalizeConfig, petAssetUrls } from '../../../plugins.v3/agentmascot/runtime/mascot-runtime.js'
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
