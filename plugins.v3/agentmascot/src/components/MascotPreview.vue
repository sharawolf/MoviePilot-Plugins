<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { buildSurfaceLanes, createMascotRuntime, resolveMascotProfile, isCustomPet } from '../runtime.js'
import { actionGroups, actionLabels } from '../actions.js'

const props = defineProps({ config: { type: Object, required: true } })
const stage = ref(null)
const paused = ref(false)
const kind = ref('action')
const frame = shallowRef(null)
const metrics = shallowRef({})
const profile = computed(() => resolveMascotProfile(props.config.mascot, props.config._pet ? [props.config._pet] : []))
const custom = computed(() => isCustomPet(props.config.mascot))
const groups = computed(() => actionGroups(props.config.mascot, kind.value))
let runtime
let observer
let mediaQuery
let disposed = false
const timeouts = new Set()

function bounds() {
  const rect = stage.value?.getBoundingClientRect()
  return { width: rect?.width || 640, height: rect?.height || 320 }
}
function render() {
  if (!runtime || disposed) return
  frame.value = runtime.renderState()
  metrics.value = runtime.debugState()
}
const previewConfig = () => ({ ...props.config, enabled: true })
function updateActivity() {
  if (!runtime) return
  if (paused.value || document.hidden) {
    runtime.stop()
    for (const timer of timeouts) window.clearTimeout(timer)
    timeouts.clear()
  }
  else runtime.start()
  render()
}
function reset() { runtime?.resetPose(); render() }
function trigger(id) {
  if (kind.value === 'behavior') runtime?.playBehavior(id)
  else runtime?.playAction(id)
  render()
}
function point(event) {
  const rect = stage.value?.getBoundingClientRect()
  return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null
}
function dragStart(event) {
  if (event.button !== 0 || paused.value) return
  event.preventDefault()
  runtime?.startDrag(point(event))
  event.currentTarget.setPointerCapture?.(event.pointerId)
}
function dragEnd(event) {
  runtime?.endDrag(point(event), event.movementX || 0, event.movementY || 0)
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
}
function click() {
  if (!paused.value && !runtime?.shouldSuppressClick()) runtime?.celebrate()
}
const petStyle = computed(() => frame.value ? {
  width: `${frame.value.size}px`, height: `${frame.value.height || frame.value.size}px`,
  transform: `translate3d(${frame.value.left}px, ${frame.value.top}px, 0) scaleX(${frame.value.flipX ?? (runtime?.pet.lookRight ? -1 : 1)})`,
} : {})
const number = value => Number.isFinite(value) ? value.toFixed(1) : '—'

watch(() => props.config, () => { runtime?.updateConfig(previewConfig()); render() }, { deep: true })
watch(custom, () => { kind.value = 'action' })
watch(paused, updateActivity)
onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  paused.value = mediaQuery.matches
  runtime = createMascotRuntime({
    bounds, getConfig: previewConfig, getSurfaceLanes: context => buildSurfaceLanes(context),
    initialPet: { anchorX: 100, anchorY: 100, targetX: 200, targetY: 100, laneY: 100 },
    onUpdate: render, snapGroundOnDragRelease: true,
    scheduler: {
      setInterval: (...args) => window.setInterval(...args), clearInterval: id => window.clearInterval(id),
      setTimeout: (callback, delay) => {
        const id = window.setTimeout(() => { timeouts.delete(id); if (!disposed) callback() }, delay)
        timeouts.add(id)
        return id
      },
      clearTimeout: id => { timeouts.delete(id); window.clearTimeout(id) },
      requestAnimationFrame: callback => window.requestAnimationFrame(callback), cancelAnimationFrame: id => window.cancelAnimationFrame(id),
    },
  })
  observer = new ResizeObserver(() => reset())
  observer.observe(stage.value)
  document.addEventListener('visibilitychange', updateActivity)
  updateActivity()
})
onBeforeUnmount(() => {
  disposed = true
  runtime?.stop()
  for (const timer of timeouts) window.clearTimeout(timer)
  timeouts.clear()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', updateActivity)
})
</script>

<template>
  <div class="am-preview">
    <div class="am-section-heading">
      <div><h3>动作预览</h3><p>使用当前设置演示，保存后应用到页面桌宠。</p></div>
      <div class="am-inline-actions">
        <VBtn size="small" variant="text" :prepend-icon="paused ? 'mdi-play-outline' : 'mdi-pause'" @click="paused = !paused">{{ paused ? '继续' : '暂停' }}</VBtn>
        <VBtn size="small" variant="text" prepend-icon="mdi-restore" @click="reset">复位</VBtn>
      </div>
    </div>
    <div class="am-preview-grid">
      <div ref="stage" class="am-stage" @pointermove="runtime?.handlePointerMove(point($event))" @pointerleave="runtime?.handlePointerLeave()">
        <div class="am-stage-caption"><span>{{ profile.label }}</span><small>{{ paused ? '预览已暂停' : '拖动角色，或单击互动' }}</small></div>
        <button v-if="frame" class="am-pet" :class="{ 'am-pet--shadow': config.shadow }" :style="petStyle" type="button" :aria-label="`与${profile.label}互动`"
          @pointerdown="dragStart" @pointermove="runtime?.moveDrag(point($event), $event.movementX || 0)"
          @pointerup="dragEnd" @pointercancel="dragEnd" @click="click">
          <span class="am-pet-frame"><img :src="frame.frame" :style="frame.imageStyle" alt="" draggable="false" /></span>
        </button>
        <div class="am-stage-ground" aria-hidden="true" />
      </div>
      <section class="am-action-panel" aria-label="动作测试">
        <div class="am-subtabs" role="tablist" aria-label="测试分类">
          <button v-for="tab in [{ id: 'action', label: '单个动作' }, ...(!custom ? [{ id: 'behavior', label: '连续行为' }] : [])]" :key="tab.id" type="button" role="tab" :aria-selected="kind === tab.id" :class="{ 'am-selected': kind === tab.id }" @click="kind = tab.id">{{ tab.label }}</button>
        </div>
        <p v-if="paused" class="am-hint">继续预览后可以测试动作。</p>
        <p v-if="custom" class="am-hint">按原素材播放；爬墙、吸顶和睡觉不适用。{{ config._pet?.version === 2 ? '开启跟随鼠标可体验视线方向。' : '' }}</p>
        <div class="am-action-scroll">
          <div v-for="group in groups" :key="group.id" class="am-action-group">
            <h4>{{ group.title }}</h4>
            <div class="am-action-buttons"><VBtn v-for="item in group.items" :key="item.id" :disabled="paused" size="small" variant="tonal" @click="trigger(item.id)">{{ item.label }}</VBtn></div>
          </div>
        </div>
      </section>
    </div>
    <div class="am-preview-status"><VIcon icon="mdi-motion-play-outline" size="18" />{{ actionLabels[metrics.action] || '待机' }}<span>动作测试仅影响此预览区</span></div>
    <details class="am-debug"><summary>调试信息</summary><dl><div v-for="(value, label) in { 表面: metrics.surface, 状态: metrics.state, 帧: metrics.poseIndex, 目标X: number(metrics.targetX), 目标Y: number(metrics.targetY), 速度X: number(metrics.vx), 速度Y: number(metrics.vy) }" :key="label"><dt>{{ label }}</dt><dd>{{ value ?? '—' }}</dd></div></dl></details>
  </div>
</template>
