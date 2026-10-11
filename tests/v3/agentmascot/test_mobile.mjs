import assert from 'node:assert/strict'
import test from 'node:test'
import { createPointerInput, viewportGeometry } from '../../../plugins.v3/agentmascot/runtime/pointer-input.js'
import { createMascotRuntime } from '../../../plugins.v3/agentmascot/runtime/mascot-runtime.js'
import { mount, unmount } from '../../../plugins.v3/agentmascot/runtime/plugin-entry.js'

test('touch scrolling, a second finger and cancellation do not steal the active drag or activate the pet', () => {
  const calls = []
  const runtime = Object.fromEntries(['startDrag', 'moveDrag', 'endDrag', 'handlePointerMove', 'handlePointerLeave']
    .map(name => [name, (...args) => calls.push([name, ...args])]))
  runtime.shouldSuppressClick = () => false
  const captured = new Set()
  const root = { setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id) }
  const event = (type, id = 1, x = 10, y = 20) => ({ type, pointerId: id, pointerType: 'touch',
    button: 0, clientX: x, clientY: y, currentTarget: root, preventDefault() {} })
  const input = createPointerInput({ getRuntime: () => runtime, point: e => ({ x: e.clientX, y: e.clientY }) })
  input.hover(event('pointermove'))
  assert.deepEqual(calls, [['handlePointerLeave']])
  input.down(event('pointerdown'))
  input.down(event('pointerdown', 2))
  input.move(event('pointermove', 2, 99, 99))
  input.end(event('pointerup', 2))
  assert.equal(calls.length, 2)
  input.move(event('pointermove', 1, 40, 60))
  assert.deepEqual(calls.at(-1), ['moveDrag', { x: 40, y: 60 }, 30])
  input.end(event('pointercancel', 1, 0, 0))
  assert.deepEqual(calls.at(-1), ['endDrag', { x: 40, y: 60 }, 0, 0])
  assert.equal(captured.size, 0)
  assert.equal(input.suppressClick(), true)
  const count = calls.length
  input.end(event('lostpointercapture'))
  assert.equal(calls.length, count)
  input.hover({ ...event('pointermove'), pointerType: 'mouse' })
  assert.equal(calls.at(-1)[0], 'handlePointerMove')
})

test('desktop bounds remain unchanged while portrait, landscape and zoom use the visual viewport', () => {
  const env = { innerWidth: 1200, innerHeight: 800 }
  assert.deepEqual(viewportGeometry(env), { width: 1200, height: 800, left: 0, top: 0, compact: false, maxScale: 4 })
  env.matchMedia = () => ({ matches: true })
  for (const [width, height] of [[320, 640], [844, 300], [195, 230]]) {
    env.visualViewport = { width, height, offsetLeft: 12, offsetTop: 50 }
    const box = viewportGeometry(env, { paddingLeft: '30px', paddingRight: '20px', paddingBottom: '34px' })
    assert.equal(box.left, 50)
    assert.equal(box.top, 58)
    assert.equal(box.width, width - 66)
    assert.equal(box.height, height - 50)
    assert.ok(box.maxScale * 96 <= 128)
  }
})

test('holding still after a drag does not turn pointerup into a tap', () => {
  const original = Date.now
  let now = 1000
  Date.now = () => now
  try {
    const runtime = { startDrag() {}, moveDrag() {}, endDrag() {}, shouldSuppressClick: () => false }
    const input = createPointerInput({ getRuntime: () => runtime, point: e => ({ x: e.clientX, y: 0 }) })
    const event = { pointerId: 1, button: 0, clientX: 0, preventDefault() {} }
    input.down(event)
    input.move({ ...event, clientX: 50 })
    now += 2000
    input.end({ ...event, type: 'pointerup', clientX: 50 })
    assert.equal(input.suppressClick(), true)
    now += 600
    assert.equal(input.suppressClick(), false)
  } finally { Date.now = original }
})

test('switching renderers or stopping cancels delayed built-in callbacks', () => {
  const callbacks = new Map()
  let serial = 0
  const scheduler = { setTimeout: fn => { callbacks.set(++serial, fn); return serial },
    clearTimeout: id => callbacks.delete(id), cancelAnimationFrame() {} }
  const runtime = createMascotRuntime({ config: { mascot: 'kurisu' }, scheduler })
  runtime.celebrate()
  assert.equal(callbacks.size, 1)
  runtime.updateConfig({ mascot: `pet_${'a'.repeat(32)}` })
  assert.equal(callbacks.size, 0)
  runtime.updateConfig({ mascot: 'kurisu' })
  runtime.celebrate(); runtime.stop()
  assert.equal(callbacks.size, 0)
})

test('federated entry uses the actual small container and releases resize and touch handlers', () => {
  const frames = new Map()
  let serial = 0, resize, observing = false
  const env = { getComputedStyle: () => ({ position: 'static' }),
    requestAnimationFrame: fn => { frames.set(++serial, fn); return serial }, cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { constructor(fn) { resize = fn } observe() { observing = true } disconnect() { observing = false } } }
  const document = { defaultView: env, createElement: () => ({ style: {}, handlers: new Map(), children: [],
    setAttribute() {}, append(...nodes) { this.children.push(...nodes) }, remove() {},
    addEventListener(name, fn) { this.handlers.set(name, fn) }, removeEventListener(name) { this.handlers.delete(name) } }) }
  let box = { width: 320, height: 180, left: 20, top: 30 }
  const container = { ...document.createElement(), ownerDocument: document, getBoundingClientRect: () => box,
    appendChild(node) { this.children.push(node) } }
  mount(container, { config: { mascot: `pet_${'a'.repeat(32)}`, scale: 4, auto_roam: false,
    _pet: { version: 2, rows: 11, sprite_url: '/sprite.png' } } })
  const root = container.children[0]
  const assertBounds = () => {
    const [, x, y] = root.style.transform.match(/translate3d\(([^p]+)px, ([^p]+)px/)
    assert.ok(Number(x) >= 0 && Number(x) + parseFloat(root.style.width) <= box.width)
    assert.ok(Number(y) >= 0 && Number(y) + parseFloat(root.style.height) <= box.height)
  }
  try {
    assertBounds()
    box = { ...box, width: 200, height: 140 }
    resize(); assertBounds()
    assert.equal(observing, true)
  } finally { unmount() }
  assert.equal(frames.size, 0)
  assert.equal(root.handlers.size, 0)
  assert.equal(container.handlers.size, 0)
  assert.equal(observing, false)
})
