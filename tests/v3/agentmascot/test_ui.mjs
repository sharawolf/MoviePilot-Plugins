import assert from 'node:assert/strict'
import test from 'node:test'
import { createConfigController } from '../../../plugins.v3/agentmascot/src/config-controller.js'
import { cloneConfig } from '../../../plugins.v3/agentmascot/src/runtime.js'
import { actionGroups } from '../../../plugins.v3/agentmascot/src/actions.js'

const config = patch => cloneConfig({ enabled: true, mascot: 'kurisu', scale: 1.55, ...patch })
const envelope = value => ({ success: true, message: '', data: value })
const status = value => envelope({ config: value })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

test('save uses the host instance endpoint, confirms readback, and preserves unrelated options', async () => {
  let persisted = config()
  const calls = []
  const control = createConfigController({
    pluginId: 'AgentMascot_clone', initialConfig: persisted,
    api: {
      put: async (path, data, options) => { calls.push(path); assert.equal(options.feedback, 'silent'); persisted = data; return envelope(null) },
      get: async (path, options) => { calls.push(path); assert.equal(options.feedback, 'silent'); return status(persisted) },
    },
  })
  control.edit('speed', 1.4)
  assert.equal(await control.save(), true)
  assert.deepEqual(calls, ['plugin/AgentMascot_clone', 'plugin/AgentMascot_clone/status'])
  assert.equal(persisted.scale, 1.55)
  assert.equal(persisted.mascot, 'kurisu')
  assert.equal(control.dirty.value, false)
  assert.match(control.state.notice, /回读确认/)
})

test('an explicit save rejection retains the complete editable draft', async () => {
  const control = createConfigController({ pluginId: 'AgentMascot', initialConfig: config(), api: { put: async () => ({ success: false, message: '保存被拒绝', data: null }) } })
  control.edit('mascot', 'nailong')
  assert.equal(await control.save(), false)
  assert.equal(control.state.saved.mascot, 'kurisu')
  assert.equal(control.state.draft.mascot, 'nailong')
  assert.equal(control.dirty.value, true)
  assert.equal(control.state.saving, false)
  assert.match(control.state.error, /保存被拒绝.*已保留/)
})

test('refresh preserves an edited draft while updating the saved snapshot', async () => {
  const request = deferred()
  const control = createConfigController({ pluginId: 'AgentMascot', initialConfig: config(), api: { get: () => request.promise } })
  const loading = control.load()
  control.edit('scale', 2)
  request.resolve(status(config({ speed: 1.3 })))
  await loading
  assert.equal(control.state.draft.scale, 2)
  assert.equal(control.state.saved.speed, 1.3)
  assert.equal(control.dirty.value, true)
  control.reset()
  assert.equal(control.state.draft.speed, 1.3)
  assert.equal(control.dirty.value, false)
})

test('late refresh responses cannot replace a newer snapshot or clear its loading state', async () => {
  const requests = [deferred(), deferred()]
  let index = 0
  const control = createConfigController({ pluginId: 'AgentMascot', api: { get: () => requests[index++].promise } })
  const first = control.load()
  const second = control.load()
  requests[0].resolve(status(config({ mascot: 'nailong' })))
  await first
  assert.equal(control.state.loading, true)
  assert.equal(control.state.ready, false)
  requests[1].resolve(status(config()))
  await second
  assert.equal(control.state.saved.mascot, 'kurisu')
  assert.equal(control.state.loading, false)
})

test('a submitted write with failed readback is not submitted a second time', async () => {
  let persisted = config()
  let writes = 0
  let offline = true
  const control = createConfigController({ pluginId: 'AgentMascot', initialConfig: persisted, api: {
    put: async (_, data) => { writes++; persisted = data; return envelope(null) },
    get: async () => { if (offline) throw new Error('offline'); return status(persisted) },
  } })
  control.edit('shadow', false)
  assert.equal(await control.save(), false)
  assert.equal(control.state.pendingReadback, true)
  assert.equal(control.state.draft.shadow, false)
  assert.match(control.state.error, /已提交.*回读/)
  assert.equal(await control.save(), false)
  assert.equal(writes, 1)
  offline = false
  await control.load()
  assert.equal(control.state.pendingReadback, false)
  assert.equal(control.dirty.value, false)
})

test('deactivation invalidates an in-flight write callback and later activation can read its result', async () => {
  const writing = deferred()
  let reads = 0
  const control = createConfigController({ pluginId: 'AgentMascot', initialConfig: config(), api: {
    put: () => writing.promise,
    get: async () => { reads++; return status(config({ speed: 1.5 })) },
  } })
  control.edit('speed', 1.5)
  const saving = control.save()
  control.suspend()
  writing.resolve(envelope(null))
  await saving
  assert.equal(reads, 0)
  assert.equal(control.state.saved.speed, 1)
  assert.equal(await control.load(), false)
  control.resume()
  await control.load()
  assert.equal(control.dirty.value, false)
})

test('missing client and malformed status do not make default values look confirmed', async () => {
  const missing = createConfigController({ pluginId: '', api: null })
  assert.equal(await missing.load(), false)
  assert.equal(missing.state.ready, false)
  const malformed = createConfigController({ pluginId: 'AgentMascot', api: { get: async () => ({}) } })
  assert.equal(await malformed.load(), false)
  assert.equal(malformed.state.ready, false)
})

test('preview action menus preserve the supported actions for every restored character', () => {
  for (const mascot of ['chibiterasu', 'nailong', 'kurisu']) {
    const groups = actionGroups(mascot)
    const actions = groups.flatMap(group => group.items.map(item => item.id))
    assert.ok(actions.includes('idle') && actions.includes('walk') && actions.includes('drag'))
    assert.ok(actionGroups(mascot, 'behavior').length > 0)
    assert.equal(new Set(actions).size, actions.length)
  }
})
