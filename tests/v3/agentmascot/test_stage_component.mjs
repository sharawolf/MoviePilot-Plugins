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
const { createRenderer, h, ref, nextTick, onErrorCaptured } = require('vue')
const result = await build({
  entryPoints: [resolve(plugin, 'src/components/AgentPet.vue')], bundle: true,
  platform: 'node', format: 'cjs', write: false, external: ['vue'],
  plugins: [{ name: 'compile-stage-with-runtime-boundary', setup(builder) {
    builder.onLoad({ filter: /src[\\/]runtime\.js$/ }, () => ({
      contents: 'export const startAgentMascotStage = (...args) => globalThis.__stageStart(...args)', loader: 'js',
    }))
    builder.onLoad({ filter: /\.vue$/ }, ({ path }) => {
      const { descriptor } = parse(readFileSync(path, 'utf8'), { filename: path })
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content,
        loader: 'js', resolveDir: dirname(path) }
    })
  } }],
})
const compiled = new Module(resolve(plugin, 'stage-component-test.cjs'))
compiled.filename = resolve(plugin, 'stage-component-test.cjs')
compiled.paths = Module._nodeModulePaths(plugin)
compiled._compile(result.outputFiles[0].text, compiled.filename)
const AgentPet = compiled.exports.default
const element = type => ({ type, children: [], parent: null })
const renderer = createRenderer({
  createElement: element, createComment: element, createText: element,
  setText() {}, setElementText() {}, patchProp() {},
  insert(el, parent) { el.parent = parent; parent.children.push(el) },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
  parentNode: el => el.parent, nextSibling: () => null,
})

test('real AgentPet Vue component passes host context, unmounts and propagates async failure to host fallback', async () => {
  const previous = globalThis.__stageStart, calls = [], errors = []
  let stops = 0
  globalThis.__stageStart = (container, options) => { calls.push({ container, options }); return { stop: () => stops++ } }
  const visible = ref(true), props = { agent: {}, pet: {}, api: {}, pluginId: 'AgentMascot_clone' }
  const app = renderer.createApp({ setup() {
    onErrorCaptured(error => { errors.push(error); visible.value = false; return false })
    return () => visible.value ? h(AgentPet, props) : null
  } })
  try {
    app.mount(element('root'))
    assert.equal(calls.length, 1)
    assert.equal(calls[0].container.type, 'div')
    for (const key of ['agent', 'pet', 'api', 'pluginId']) assert.equal(calls[0].options[key], props[key])
    visible.value = false
    await nextTick()
    assert.equal(stops, 1)
    visible.value = true
    await nextTick()
    assert.equal(calls.length, 2, 'a new host session mounts a new stage')
    calls[1].options.onError(new Error('sprite unavailable'))
    await nextTick(); await nextTick()
    assert.equal(errors[0].message, 'sprite unavailable')
    assert.equal(stops, 2, 'host fallback releases the failed stage')
  } finally { app.unmount(); globalThis.__stageStart = previous }
})
