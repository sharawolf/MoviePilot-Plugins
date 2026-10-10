import { computed, reactive } from 'vue'
import { cloneConfig, unwrapResponse, petAssetUrls } from './runtime.js'

const fingerprint = config => JSON.stringify(cloneConfig(config))
const cancelled = error => error?.name === 'AbortError' || error?.code === 'ERR_CANCELED'

/** Keep the editable draft separate from confirmed server configuration. */
export function createConfigController({ api, pluginId, initialConfig = null, onSaved = () => {} }) {
  const state = reactive({
    draft: cloneConfig(initialConfig), saved: cloneConfig(initialConfig),
    ready: Boolean(initialConfig && 'enabled' in initialConfig),
    loading: false, saving: false, error: '', notice: '', pendingReadback: false, pets: [],
  })
  const dirty = computed(() => fingerprint(state.draft) !== fingerprint(state.saved))
  let active = true
  let generation = 0

  function requireClient(method) {
    if (!pluginId || !api?.[method]) throw new Error('宿主连接尚未就绪，请重新打开插件页面。')
  }

  async function readStatus() {
    requireClient('get')
    const data = unwrapResponse(await api.get(`plugin/${pluginId}/status`, { feedback: 'silent' }))
    if (!data?.config || typeof data.config.enabled !== 'boolean') throw new Error('未取得有效配置，请稍后刷新。')
    return { config: cloneConfig(data.config), pets: (data.pets || []).map(pet => petAssetUrls(pet)) }
  }

  function accept(config, submitted = null) {
    const preserve = dirty.value && (submitted === null || fingerprint(state.draft) !== fingerprint(submitted))
    state.saved = cloneConfig(config)
    if (!preserve) state.draft = cloneConfig(config)
    state.ready = true
    state.pendingReadback = false
    return preserve
  }

  async function load() {
    if (!active || state.saving) return false
    const request = ++generation
    state.loading = true
    state.error = ''
    try {
      const { config, pets } = await readStatus()
      if (!active || request !== generation) return false
      state.pets = pets
      const preserved = accept(config)
      state.notice = preserved && dirty.value ? '已刷新已保存配置，当前修改仍保留。' : '已读取最新配置。'
      return true
    } catch (error) {
      if (active && request === generation && !cancelled(error)) state.error = error.message || '读取配置失败，请重试。'
      return false
    } finally {
      if (active && request === generation) state.loading = false
    }
  }

  async function save() {
    if (!active || !state.ready || state.loading || state.saving || state.pendingReadback || !dirty.value) return false
    const request = ++generation
    const submitted = cloneConfig(state.draft)
    state.saving = true
    state.error = ''
    state.notice = ''
    let acknowledged = false
    try {
      requireClient('put')
      unwrapResponse(await api.put(`plugin/${pluginId}`, submitted, { feedback: 'silent' }))
      acknowledged = true
      if (!active || request !== generation) return false
      const { config, pets } = await readStatus()
      if (!active || request !== generation) return false
      state.pets = pets
      accept(config, submitted)
      state.notice = dirty.value ? '本次设置已保存，后续修改尚未保存。' : '设置已保存并回读确认。'
      // UI/session coordination must not turn a confirmed save into a failure.
      try { await onSaved(config) } catch {
        if (active && request === generation) state.notice += ' 桌宠将在下次状态检查时更新。'
      }
      return true
    } catch (error) {
      if (active && request === generation) {
        state.pendingReadback = acknowledged
        if (!cancelled(error)) state.error = acknowledged
          ? '配置已提交，但回读未完成。请刷新状态确认，当前修改已保留。'
          : `${error.message || '保存失败'} 当前修改已保留。`
      }
      return false
    } finally {
      if (active && request === generation) state.saving = false
    }
  }

  function edit(key, value) {
    if (!active || !state.ready || state.saving) return
    state.draft = cloneConfig({ ...state.draft, [key]: value })
    state.notice = ''
  }

  function reset() {
    if (state.saving || state.pendingReadback) return
    state.draft = cloneConfig(state.saved)
    state.notice = '已撤销未保存的修改。'
    state.error = ''
  }

  function suspend() {
    active = false
    generation++
    state.loading = false
    state.saving = false
  }

  return { state, dirty, load, save, edit, reset, suspend, resume: () => { active = true } }
}
