import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { runtimeRevision, runtimeFiles } from '../../../plugins.v3/agentmascot/build-runtime.mjs'

const plugin = new URL('../../../plugins.v3/agentmascot/', import.meta.url)
const assets = new URL('dist/assets/', plugin)

test('all runtime imports and both entry points use the current content revision', () => {
  for (const filename of readdirSync(assets).filter(name => name.endsWith('.js'))) {
    const code = readFileSync(new URL(filename, assets), 'utf8')
    for (const match of code.matchAll(/['"]\.{1,2}\/([^'"?]+)(\?[^'"]*)?['"]/g)) {
      if (runtimeFiles.includes(match[1].split('/').pop())) assert.equal(match[2], `?v=${runtimeRevision}`, filename)
    }
  }
  for (const filename of ['agentmascot-loader.js', 'agentmascot-loader.global.js']) {
    const code = readFileSync(new URL(filename, assets), 'utf8')
    assert.ok(code.includes(runtimeRevision))
    assert.ok(!code.includes('__AGENTMASCOT_RUNTIME_REVISION__'))
  }
})

test('built federation exposes load with host Vue and resolve their styles', async () => {
  const require = createRequire(new URL('package.json', plugin))
  const vue = require('vue')
  const links = []
  const previousDocument = globalThis.document
  globalThis.document = {
    createElement: () => ({}),
    head: { appendChild: element => links.push(element) },
  }
  try {
    const remote = await import(new URL('remoteEntry.js', assets))
    remote.init({ vue: { [vue.version]: { get: async () => () => vue } } })
    for (const name of ['Config', 'Page', 'AppPage', 'PluginEntry']) {
      const factory = await remote.get(`./${name}`)
      assert.equal(typeof factory, 'function', name)
      assert.ok(factory(), `${name} returns its component/module`)
    }
    assert.ok(links.length > 0, 'component styles are registered')
    for (const link of links) {
      assert.equal(link.rel, 'stylesheet')
      assert.ok(existsSync(new URL(link.href)), `missing style: ${link.href}`)
    }
  } finally {
    globalThis.document = previousDocument
  }
})

test('built relative imports exist and the character engine matches its verified hash', () => {
  for (const filename of readdirSync(assets).filter(name => name.endsWith('.js'))) {
    const file = new URL(filename, assets)
    const source = readFileSync(file, 'utf8')
    const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|__federation_import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g
    for (const match of source.matchAll(pattern)) {
      assert.ok(existsSync(new URL(match[1], file)), `${filename} -> ${match[1]}`)
    }
  }
  const expected = 'd312b1f8aaf423deda16447690b09f6537a087f43ef6867a3c5c59b6e5a49eb4'
  for (const relative of ['runtime/runtime-BCybTabx.js', 'dist/assets/runtime-BCybTabx.js']) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(relative, plugin))).digest('hex'), expected)
  }
})
