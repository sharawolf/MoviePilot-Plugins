import { reactive } from 'vue'
import { unwrapResponse, petAssetUrls } from './runtime.js'

export function createPetLibraryController({ api, pluginId, onImported, onRemoved }) {
  const state = reactive({ busy: false, candidate: null, error: '', notice: '', filename: '', removeId: '' })
  let active = true, generation = 0, file = null
  async function upload(nextFile, save) {
    if (!active || state.busy) return false
    const request = ++generation
    state.error = ''; state.notice = ''
    if (!save) { state.candidate = null; file = null; state.filename = '' }
    if (!nextFile || nextFile.size > 64 * 1024 * 1024 || !/\.zip$/i.test(nextFile.name)) {
      state.error = '请选择不超过 64 MiB 的 ZIP 文件。'; return false
    }
    state.busy = true
    try {
      const form = new FormData()
      form.append('file', nextFile)
      const data = unwrapResponse(await api.post(`plugin/${pluginId}/pets/${save ? 'import' : 'inspect'}`, form, { feedback: 'silent' }))
      if (!active || request !== generation) return false
      if (!data?.pet?.id || !data.pet.sprite_url) throw new Error('未收到完整的角色信息。')
      if (save) {
        onImported(petAssetUrls(data.pet))
        state.candidate = null; file = null; state.filename = ''
        state.notice = '已加入角色库并选为草稿，点击底部「保存设置」后使用。'
      } else {
        file = nextFile; state.filename = nextFile.name; state.candidate = data.pet
      }
      return true
    } catch (error) {
      if (active && request === generation) state.error = error.message || '导入失败，请重试。'
      return false
    } finally {
      if (active && request === generation) state.busy = false
    }
  }
  async function remove() {
    if (!active || state.busy || !state.removeId) return false
    const id = state.removeId, request = ++generation
    state.busy = true; state.error = ''; state.notice = ''
    try {
      unwrapResponse(await api.delete(`plugin/${pluginId}/pets/${id}`, { feedback: 'silent' }))
      if (!active || request !== generation) return false
      onRemoved(id); state.removeId = ''; state.notice = '角色已移除。'
      return true
    } catch (error) {
      if (active && request === generation) state.error = error.message || '移除失败，请重试。'
      return false
    } finally { if (active && request === generation) state.busy = false }
  }
  return { state, inspect: next => upload(next, false), save: () => upload(file, true), remove,
    cancel() { if (!state.busy) { file = null; state.candidate = null; state.filename = '' } },
    suspend() { active = false; generation++; file = null; state.candidate = null; state.busy = false },
  }
}
