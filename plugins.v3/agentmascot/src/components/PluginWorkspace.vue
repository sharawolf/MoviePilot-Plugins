<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useId } from 'vue'
import MascotPreview from './MascotPreview.vue'
import PetLibrary from './PetLibrary.vue'
import { hostProps } from '../props.js'
import { createConfigController } from '../config-controller.js'
import { MASCOT_OPTIONS, resolveMascotProfile, startAgentMascotPatchEntry } from '../runtime.js'
import '../style.css'

const props = defineProps({ ...hostProps, mode: { type: String, default: 'config' } })
const emit = defineEmits(['close', 'layout'])
const activeTab = ref(props.mode === 'config' ? 'overview' : 'preview')
const visible = ref(true)
const discardPrompt = ref(false)
const libraryBusy = ref(false)
const fieldId = useId()
const session = ref({ mounted: false, syncing: true, nativeEntryAvailable: false })
const tabs = [
  { key: 'overview', label: '运行总览', icon: 'mdi-view-dashboard-outline', description: '查看已保存设置与当前页面状态' },
  { key: 'basic', label: '基础设置', icon: 'mdi-tune-variant', description: '控制桌宠启用与页面入口' },
  { key: 'appearance', label: '形象与行为', icon: 'mdi-palette-outline', description: '选择角色，调整大小和活动方式' },
  { key: 'preview', label: '动作预览', icon: 'mdi-motion-play-outline', description: '在独立预览区体验角色动作' },
]
const currentTab = computed(() => tabs.find(tab => tab.key === activeTab.value))
const controller = createConfigController({
  api: props.api, pluginId: props.pluginId, initialConfig: props.initialConfig,
  onSaved: async () => {
    if (window.__AgentMascotGlobalLoader?.pluginId === props.pluginId) await window.__AgentMascotGlobalLoader.sync()
    updateSession()
  },
})
const { state, dirty } = controller
const profile = computed(() => resolveMascotProfile(state.draft.mascot, state.pets))
const savedProfile = computed(() => resolveMascotProfile(state.saved.mascot, state.pets))
const previewConfig = computed(() => ({ ...state.draft, _pet: state.pets.find(pet => pet.id === state.draft.mascot) }))
const busy = computed(() => state.loading || state.saving || libraryBusy.value)
const controlsDisabled = computed(() => !state.ready || busy.value || state.pendingReadback)
const feedback = computed(() => state.saving ? '正在保存并回读配置…' : state.loading ? '正在读取配置…' : state.error || (dirty.value ? '有未保存修改，保存后应用到桌宠。' : state.notice || '配置已同步。'))
let sessionTimer
let mounted = false

function updateSession() {
  if (!visible.value) return
  const handle = window.__AgentMascotGlobalLoader
  session.value = handle?.pluginId === props.pluginId
    ? handle.getState?.() || { mounted: Boolean(document.getElementById('agentmascot-global-root')), syncing: false }
    : { mounted: false, syncing: false, nativeEntryAvailable: false }
}
function startSessionObserver() {
  window.clearInterval(sessionTimer)
  if (!document.hidden) sessionTimer = window.setInterval(updateSession, 2000)
  updateSession()
}
function visibilityChanged() {
  if (document.hidden) window.clearInterval(sessionTimer)
  else if (visible.value) startSessionObserver()
}
async function initialize() {
  if (!await controller.load() || !visible.value) return
  startAgentMascotPatchEntry(window, { api: props.api, pluginId: props.pluginId })
  startSessionObserver()
}
async function refresh() {
  if (await controller.load() && visible.value) {
    const handle = startAgentMascotPatchEntry(window, { api: props.api, pluginId: props.pluginId })
    await handle.sync()
    startSessionObserver()
    updateSession()
  }
}
function close() {
  if (state.saving || libraryBusy.value) return
  if (dirty.value || state.pendingReadback) discardPrompt.value = true
  else emit('close')
}
function imported(pet) {
  state.pets = [...state.pets.filter(item => item.id !== pet.id), pet]
  controller.edit('mascot', pet.id)
}
function removed(id) {
  state.pets = state.pets.filter(pet => pet.id !== id)
  if (state.draft.mascot === id) controller.edit('mascot', state.saved.mascot)
}
function deactivate() {
  visible.value = false
  controller.suspend()
  window.clearInterval(sessionTimer)
  document.removeEventListener('visibilitychange', visibilityChanged)
}
onMounted(() => {
  mounted = true
  emit('layout', { maxWidth: '70rem' })
  document.addEventListener('visibilitychange', visibilityChanged)
  void initialize()
})
onDeactivated(deactivate)
onActivated(() => {
  if (!mounted || visible.value) return
  visible.value = true
  controller.resume()
  document.addEventListener('visibilitychange', visibilityChanged)
  void initialize()
})
onBeforeUnmount(deactivate)
</script>

<template>
  <section class="am-workspace" :class="[`am-workspace--${mode}`, { 'am-workspace--overview': activeTab === 'overview' }]" aria-label="Agent 桌宠控制台">
    <header class="am-header">
      <div class="am-brand"><div class="am-brand-avatar"><img :src="profile.icon" alt="" /></div><div><h2>{{ mode === 'config' ? '桌宠设置' : 'Agent 桌宠' }}</h2><p>{{ currentTab.description }}</p></div></div>
      <div class="am-header-actions">
        <VChip class="am-enabled-chip" size="small" :color="state.ready && state.saved.enabled ? 'success' : 'default'" variant="tonal">{{ !state.ready ? '待读取' : state.saved.enabled ? '已启用' : '已停用' }}</VChip>
        <VBtn icon="mdi-refresh" size="small" variant="text" :loading="state.loading" :disabled="state.saving || libraryBusy" aria-label="刷新状态" title="刷新状态" @click="refresh" />
        <VBtn v-if="mode !== 'app'" icon="mdi-close" size="small" variant="text" :disabled="state.saving || libraryBusy" aria-label="关闭" title="关闭" @click="close" />
      </div>
    </header>
    <div class="am-body">
      <nav class="am-nav" aria-label="桌宠设置导航">
        <VList nav density="compact" class="am-nav-list"><VListItem v-for="tab in tabs" :key="tab.key" :active="activeTab === tab.key" color="primary" rounded="lg" :prepend-icon="tab.icon" :title="tab.label" :disabled="state.saving || libraryBusy" @click="activeTab = tab.key" /></VList>
      </nav>
      <main class="am-content" :class="{ 'am-content--overview': activeTab === 'overview' }">
        <div v-if="!state.ready" class="am-empty" role="status">
          <VProgressCircular v-if="state.loading" indeterminate color="primary" size="32" />
          <VIcon v-else icon="mdi-cloud-alert-outline" size="36" color="warning" />
          <h3>{{ state.loading ? '正在读取桌宠设置' : '暂时无法读取设置' }}</h3>
          <p>{{ state.loading ? '连接就绪后即可调整形象与动作。' : state.error || '请检查宿主连接后重试。' }}</p>
          <VBtn v-if="!state.loading" variant="tonal" color="primary" prepend-icon="mdi-refresh" @click="refresh">重新读取</VBtn>
        </div>
        <template v-else-if="activeTab === 'overview'">
          <div class="am-section-heading"><div><h3>运行总览</h3><p>以下状态基于已保存设置与当前页面。</p></div></div>
          <ol class="am-flow">
            <li :class="{ 'am-flow--ready': state.saved.enabled }"><span>1</span><div><strong>启用桌宠</strong><small>{{ state.saved.enabled ? '已保存为启用' : '前往基础设置启用' }}</small></div></li>
            <li :class="{ 'am-flow--ready': session.mounted }"><span>2</span><div><strong>加载页面形象</strong><small>{{ session.syncing ? '正在检查' : session.mounted ? '当前页面已显示' : '当前页面未显示' }}</small></div></li>
            <li :class="{ 'am-flow--ready': session.mounted && session.nativeEntryAvailable }"><span>3</span><div><strong>连接智能助手</strong><small>{{ !state.saved.replace_agent_entry ? '入口替换已关闭' : session.mounted && session.nativeEntryAvailable ? '原生入口可用' : '等待原生入口就绪' }}</small></div></li>
          </ol>
          <div class="am-overview-grid">
            <section class="am-summary-card"><img :src="savedProfile.icon" alt="" /><div><span class="am-eyebrow">当前形象</span><strong>{{ savedProfile.label }}</strong><p>大小 {{ state.saved.scale.toFixed(2) }}× · 速度 {{ state.saved.speed.toFixed(2) }}×</p></div></section>
            <section class="am-summary-card"><VIcon icon="mdi-cursor-default-outline" size="30" color="primary" /><div><span class="am-eyebrow">活动方式</span><strong>{{ state.saved.auto_roam ? '自动游走' : '自由互动' }}</strong><p>{{ state.saved.follow_mouse ? '跟随鼠标' : '不跟随鼠标' }} · {{ state.saved.shadow ? '显示阴影' : '隐藏阴影' }}</p></div></section>
          </div>
          <section class="am-note"><VIcon icon="mdi-information-outline" size="22" color="primary" /><div><h4>刷新后，重新打开一次桌宠页面</h4><p>打开侧栏「Agent 桌宠」或插件详情即可加载，随后切换页面会保留。整页刷新后需要再次打开。</p></div></section>
          <section class="am-note am-note--subtle"><VIcon icon="mdi-lifebuoy" size="22" /><div><h4>桌宠没有出现？</h4><p>先检查基础设置中的启用和入口替换开关，再点击右上角刷新。停用后，当前页面会在下次状态检查时恢复原生入口。</p></div></section>
          <div class="am-overview-actions"><VBtn variant="tonal" color="primary" prepend-icon="mdi-tune-variant" @click="activeTab = 'basic'">调整设置</VBtn><VBtn variant="text" prepend-icon="mdi-motion-play-outline" @click="activeTab = 'preview'">体验动作</VBtn></div>
        </template>
        <template v-else-if="activeTab === 'basic'">
          <div class="am-section-heading"><div><h3>基础设置</h3><p>修改暂存为草稿，点击底部保存后生效。</p></div></div>
          <VCard class="am-setting-card" variant="outlined"><VCardItem title="启用桌宠" subtitle="允许页面加载所选角色"><template #append><VSwitch :model-value="state.draft.enabled" :disabled="controlsDisabled" color="success" density="compact" hide-details inset aria-label="启用桌宠" @update:model-value="controller.edit('enabled', $event)" /></template></VCardItem></VCard>
          <VCard class="am-setting-card" variant="outlined"><VCardItem title="替换智能助手入口" subtitle="单击桌宠打开原生智能助手"><template #append><VSwitch :model-value="state.draft.replace_agent_entry" :disabled="controlsDisabled" color="primary" density="compact" hide-details inset aria-label="替换智能助手入口" @update:model-value="controller.edit('replace_agent_entry', $event)" /></template></VCardItem></VCard>
          <VCard class="am-setting-card" variant="outlined"><VCardItem title="显示侧栏入口" subtitle="在侧栏保留「Agent 桌宠」快捷入口"><template #append><VSwitch :model-value="state.draft.show_sidebar_nav" :disabled="controlsDisabled" color="primary" density="compact" hide-details inset aria-label="显示侧栏入口" @update:model-value="controller.edit('show_sidebar_nav', $event)" /></template></VCardItem></VCard>
          <p class="am-hint">关闭侧栏入口后，仍可从插件详情打开桌宠页面。</p>
        </template>
        <template v-else-if="activeTab === 'appearance'">
          <div class="am-section-heading"><div><h3>形象与行为</h3><p>选择角色，调整它在页面上的活动方式。</p></div><VBtn size="small" variant="text" prepend-icon="mdi-motion-play-outline" @click="activeTab = 'preview'">预览效果</VBtn></div>
          <div class="am-character-grid" role="group" aria-label="桌宠形象">
            <button v-for="option in MASCOT_OPTIONS" :key="option.value" type="button" class="am-character" :class="{ 'am-character--selected': state.draft.mascot === option.value }" :aria-pressed="state.draft.mascot === option.value" :disabled="controlsDisabled" @click="controller.edit('mascot', option.value)"><img :src="resolveMascotProfile(option.value).icon" alt="" /><strong>{{ option.value === 'kurisu' ? '克里斯蒂娜' : option.title }}</strong><VIcon v-if="state.draft.mascot === option.value" class="am-character-check" icon="mdi-check-circle" size="19" color="primary" /></button>
          </div>
          <PetLibrary v-if="visible" :api="props.api" :plugin-id="props.pluginId" :pets="state.pets" :config="state.draft" :saved-id="state.saved.mascot" :disabled="!state.ready || state.loading || state.saving || state.pendingReadback" @select="controller.edit('mascot', $event)" @imported="imported" @removed="removed" @busy="libraryBusy = $event" />
          <div class="am-slider-grid">
            <section class="am-slider-card"><label :id="`${fieldId}-scale`">角色大小 <strong>{{ state.draft.scale.toFixed(2) }}×</strong></label><VSlider :model-value="state.draft.scale" :disabled="controlsDisabled" min="0.6" max="4" step="0.05" hide-details color="primary" :aria-labelledby="`${fieldId}-scale`" @update:model-value="controller.edit('scale', $event)" /><p>0.60× — 4.00×</p></section>
            <section class="am-slider-card"><label :id="`${fieldId}-speed`">移动速度 <strong>{{ state.draft.speed.toFixed(2) }}×</strong></label><VSlider :model-value="state.draft.speed" :disabled="controlsDisabled" min="0.4" max="2" step="0.05" hide-details color="primary" :aria-labelledby="`${fieldId}-speed`" @update:model-value="controller.edit('speed', $event)" /><p>0.40× — 2.00×</p></section>
          </div>
          <div class="am-behaviors"><VSwitch v-for="item in [{ key: 'follow_mouse', label: '跟随鼠标' }, { key: 'auto_roam', label: '自动游走' }, { key: 'shadow', label: '地面阴影' }]" :key="item.key" :model-value="state.draft[item.key]" :disabled="controlsDisabled" :label="item.label" hide-details inset density="compact" color="primary" @update:model-value="controller.edit(item.key, $event)" /></div>
        </template>
        <MascotPreview v-else-if="activeTab === 'preview' && visible" :config="previewConfig" />
      </main>
    </div>
    <footer class="am-footer">
      <template v-if="discardPrompt"><div class="am-feedback" role="alert">{{ state.pendingReadback ? '配置已提交但尚未确认，关闭不会撤回已提交内容。' : '关闭将放弃未保存的修改。' }}</div><div class="am-footer-actions"><VBtn variant="text" @click="discardPrompt = false">继续编辑</VBtn><VBtn variant="tonal" color="warning" @click="emit('close')">{{ state.pendingReadback ? '仍然关闭' : '放弃并关闭' }}</VBtn></div></template>
      <template v-else><div class="am-feedback" :class="{ 'am-feedback--error': state.error }" aria-live="polite"><VIcon :icon="state.error ? 'mdi-alert-circle-outline' : dirty ? 'mdi-pencil-outline' : 'mdi-check-circle-outline'" size="18" /><span>{{ feedback }}</span></div><div class="am-footer-actions"><VBtn v-if="dirty" variant="text" :disabled="busy || state.pendingReadback" @click="controller.reset">撤销修改</VBtn><VBtn v-else-if="mode !== 'app'" variant="text" :disabled="state.saving" @click="close">关闭</VBtn><VBtn v-if="state.pendingReadback" variant="flat" color="primary" :loading="state.loading" @click="refresh">刷新确认</VBtn><VBtn v-else variant="flat" color="primary" prepend-icon="mdi-content-save-outline" :loading="state.saving" :disabled="!dirty || !state.ready || state.loading || libraryBusy" @click="controller.save">保存设置</VBtn></div></template>
    </footer>
  </section>
</template>
