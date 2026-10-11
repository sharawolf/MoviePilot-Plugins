// Shared by the global entry, federated entry and Vue preview.
export function createPointerInput({ getRuntime, point, paused = () => false, render = () => {}, onInteracting = () => {} }) {
  let active = null, start = null, last = null, moved = false, suppressUntil = 0
  const hover = event => {
    if (event.pointerType && event.pointerType !== 'mouse') getRuntime()?.handlePointerLeave()
    else if (event.isPrimary !== false) getRuntime()?.handlePointerMove(point(event))
    render()
  }
  function down(event) {
    if (paused() || active !== null || event.isPrimary === false || event.button !== 0) return
    event.preventDefault()
    active = event.pointerId
    moved = false
    start = last = point(event)
    getRuntime()?.startDrag(start)
    onInteracting(true)
    event.currentTarget?.setPointerCapture?.(active)
  }
  function move(event) {
    if (active === null || event.pointerId !== active) return
    const next = point(event)
    if (Math.hypot(next.x - start.x, next.y - start.y) > 5) { moved = true; suppressUntil = Date.now() + 500 }
    getRuntime()?.moveDrag(next, next.x - last.x)
    last = next
  }
  function end(event) {
    if (active === null || event.pointerId !== active) return
    const cancelled = event.type === 'pointercancel' || event.type === 'lostpointercapture'
    if (cancelled || moved) suppressUntil = Date.now() + 500
    getRuntime()?.endDrag(cancelled ? last : point(event), 0, 0)
    const id = active
    active = null
    onInteracting(false)
    if (event.currentTarget?.hasPointerCapture?.(id)) event.currentTarget.releasePointerCapture(id)
  }
  return { hover, down, move, end,
    leave() { getRuntime()?.handlePointerLeave() },
    suppressClick: () => Date.now() < suppressUntil || getRuntime()?.shouldSuppressClick(),
    reset() { if (active !== null) { getRuntime()?.endDrag(last, 0, 0); onInteracting(false) } active = null; start = last = null },
  }
}

export function viewportGeometry(env, safeArea = {}) {
  const viewport = env.visualViewport
  const width = viewport?.width || env.innerWidth, height = viewport?.height || env.innerHeight
  const compact = width <= 600 || Boolean(env.matchMedia?.('(pointer: coarse)')?.matches)
  const gap = compact ? 8 : 0
  const inset = side => Math.max(0, Number.parseFloat(safeArea[side]) || 0) + gap
  const left = inset('paddingLeft'), right = inset('paddingRight')
  const top = inset('paddingTop'), bottom = inset('paddingBottom')
  return { left: (viewport?.offsetLeft || 0) + left, top: (viewport?.offsetTop || 0) + top,
    width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom), compact,
    maxScale: compact ? Math.min(128, Math.max(24, (width - left - right) * .32)) / 96 : 4 }
}
