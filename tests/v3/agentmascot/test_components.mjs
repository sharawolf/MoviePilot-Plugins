import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire, Module } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const plugin = fileURLToPath(new URL('../../../plugins.v3/agentmascot/', import.meta.url))
const require = createRequire(resolve(plugin, 'package.json'))
const { build } = require('esbuild')
const { parse, compileScript } = require('@vue/compiler-sfc')
const { createRenderer, defineComponent, h, nextTick } = require('vue')
const result = await build({
  entryPoints: [resolve(plugin, 'src/components/Config.vue')], bundle: true,
  platform: 'node', format: 'cjs', write: false, external: ['vue'],
  plugins: [{ name: 'compile-real-sfc', setup(builder) {
    builder.onLoad({ filter: /\.vue$/ }, ({ path }) => {
      const { descriptor } = parse(readFileSync(path, 'utf8'), { filename: path })
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'js', resolveDir: dirname(path) }
    })
    builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }))
  } }],
})
const compiled = new Module(resolve(plugin, 'component-test.cjs'))
compiled.filename = resolve(plugin, 'component-test.cjs')
compiled.paths = Module._nodeModulePaths(plugin)
compiled._compile(result.outputFiles[0].text, compiled.filename)
const Config = compiled.exports.default

function node(type, text = '') {
  return { type, text, props: {}, children: [], parent: null, getBoundingClientRect: () => ({ width: 600, height: 320, left: 0, top: 0 }) }
}
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (el, text) => { el.text = text },
  setElementText: (el, text) => { el.text = text; el.children = [] },
  patchProp: (el, key, _, value) => { el.props[key] = value },
  insert(el, parent, anchor = null) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(el); else parent.children.splice(index, 0, el)
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = null },
  parentNode: el => el.parent,
  nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] || null,
})
function descendants(root) { return [root, ...root.children.flatMap(descendants)] }
const text = root => descendants(root).map(n => n.type === 'comment' ? '' : n.text).join('')
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }

test('real Config component connects navigation, discard protection, host save and preview cleanup', async () => {
  const previous = { window: globalThis.window, document: globalThis.document, ResizeObserver: globalThis.ResizeObserver }
  let serial = 0
  const timers = new Set()
  const frames = new Set()
  const listeners = new Set()
  let observers = 0
  const handle = { pluginId: 'AgentMascot_clone', sync: async () => {}, getState: () => ({ mounted: true, nativeEntryAvailable: true }) }
  globalThis.window = {
    __AgentMascotGlobalLoader: handle,
    setInterval: () => { const id = ++serial; timers.add(id); return id }, clearInterval: id => timers.delete(id),
    setTimeout: () => { const id = ++serial; timers.add(id); return id }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => { const id = ++serial; frames.add(id); return id }, cancelAnimationFrame: id => frames.delete(id),
    matchMedia: () => ({ matches: false }),
  }
  globalThis.document = { hidden: false, addEventListener: (_, cb) => listeners.add(cb), removeEventListener: (_, cb) => listeners.delete(cb) }
  globalThis.ResizeObserver = class { observe() { observers++ } disconnect() { observers-- } }
  let persisted = { enabled: true, mascot: 'kurisu', scale: 1.55, speed: 1, replace_agent_entry: true }
  let pets = []
  const importedPet = { id: `pet_${'a'.repeat(32)}`, name: '导入样本', version: 2, rows: 11, icon: '', sprite_url: 'data:image/png;base64,test' }
  let writes = 0
  const events = []
  const app = renderer.createApp(Config, {
    pluginId: 'AgentMascot_clone', initialConfig: persisted,
    api: {
      get: async () => ({ success: true, message: '', data: { config: persisted, pets } }),
      post: async (path, form) => {
        assert.ok(form instanceof FormData)
        if (path.endsWith('/import')) pets = [importedPet]
        return { success: true, message: '', data: { pet: importedPet } }
      },
      put: async (path, data) => { assert.equal(path, 'plugin/AgentMascot_clone'); writes++; persisted = data; return { success: true, message: '', data: null } },
    },
    onLayout: value => events.push(value), onClose: () => events.push('close'),
  })
  for (const name of ['VBtn', 'VChip', 'VIcon', 'VList', 'VListItem', 'VCard', 'VCardItem', 'VSwitch', 'VSlider', 'VProgressCircular']) {
    app.component(name, defineComponent({
      props: ['title', 'subtitle'],
      setup(props, { attrs, slots }) { return () => h('mock', { ...attrs, 'data-component': name, title: props.title }, [props.title, props.subtitle, slots.default?.(), slots.append?.()]) },
    }))
  }
  const root = node('root')
  try {
    app.mount(root)
    await flush()
    assert.ok(text(root).includes('以下状态基于已保存设置'))
    assert.deepEqual(events[0], { maxWidth: '70rem' })
    const find = predicate => { const found = descendants(root).find(predicate); assert.ok(found); return found }
    const nav = async title => { find(n => n.props.title === title).props.onClick(); await nextTick() }
    await nav('基础设置')
    find(n => n.props['aria-label'] === '启用桌宠').props['onUpdate:modelValue'](false)
    await nextTick()
    find(n => n.props['aria-label'] === '关闭').props.onClick()
    await nextTick()
    assert.ok(text(root).includes('关闭将放弃未保存'))
    assert.ok(!events.includes('close'))
    find(n => n.props['data-component'] === 'VBtn' && text(n) === '继续编辑').props.onClick()
    await nextTick()
    find(n => n.props['data-component'] === 'VBtn' && text(n) === '保存设置').props.onClick()
    await flush()
    assert.equal(writes, 1)
    assert.equal(persisted.enabled, false)
    assert.ok(text(root).includes('设置已保存并回读确认'))
    await nav('形象与行为')
    assert.equal(descendants(root).filter(n => n.props.class?.includes('am-character ') || n.props.class === 'am-character').length, 3)
    await nav('动作预览')
    await flush()
    assert.equal(observers, 1)
    assert.ok(frames.size > 0)
    assert.ok(text(root).includes('单个动作') && text(root).includes('连续行为'))
    await nav('运行总览')
    assert.equal(observers, 0)
    assert.equal(frames.size, 0)
    await nav('形象与行为')
    find(n => n.props['aria-label'] === '选择 Pet 压缩包').props.onChange({ target: { files: [new File(['zip'], 'pet.zip')], value: 'pet.zip' } })
    await flush()
    assert.ok(text(root).includes('导入样本'))
    assert.equal(observers, 1)
    find(n => n.props['data-component'] === 'VBtn' && text(n) === '保存到角色库').props.onClick()
    await flush()
    assert.equal(observers, 0)
    assert.equal(persisted.mascot, 'kurisu')
    find(n => n.props['data-component'] === 'VBtn' && text(n) === '保存设置').props.onClick()
    await flush()
    assert.equal(persisted.mascot, importedPet.id)
    await nav('动作预览')
    await flush()
    assert.ok(text(root).includes('Pet 原生动作'))
    assert.ok(!text(root).includes('连续行为'))
    assert.equal(observers, 1)
    await nav('运行总览')
    assert.equal(observers, 0)
    assert.equal(frames.size, 0)
  } finally {
    app.unmount()
    Object.assign(globalThis, previous)
  }
  assert.equal(timers.size, 0)
  assert.equal(listeners.size, 0)
})
