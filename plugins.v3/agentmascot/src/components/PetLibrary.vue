<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MascotPreview from './MascotPreview.vue'
import { createPetLibraryController } from '../pet-library-controller.js'

const props = defineProps({ api: [Object, Function], pluginId: String, pets: Array, config: Object,
  savedId: String, disabled: Boolean })
const emit = defineEmits(['select', 'imported', 'removed', 'busy'])
const input = ref(null)
const controller = createPetLibraryController({ api: props.api, pluginId: props.pluginId,
  onImported: pet => emit('imported', pet), onRemoved: id => emit('removed', id) })
const { state } = controller
const previewConfig = computed(() => ({ ...props.config, mascot: state.candidate?.id,
  _pet: state.candidate, follow_mouse: true, auto_roam: false }))
watch(() => state.busy, value => emit('busy', value))
function selectFile(event) { const file = event.target.files?.[0]; if (file) void controller.inspect(file); event.target.value = '' }
onBeforeUnmount(() => { controller.suspend(); emit('busy', false) })
</script>

<template>
  <section class="am-library" aria-label="导入角色库">
    <div class="am-section-heading"><div><h3>导入角色</h3><p>兼容 Codex Pet v1 / v2 ZIP，角色会保留在插件数据目录。</p></div>
      <VBtn variant="tonal" color="primary" prepend-icon="mdi-upload" :loading="state.busy" :disabled="disabled" @click="input?.click()">导入 Pet</VBtn>
      <input ref="input" type="file" accept=".zip,application/zip" class="am-file-input" aria-label="选择 Pet 压缩包" :disabled="disabled || state.busy" @change="selectFile" />
    </div>
    <p v-if="state.error" class="am-library-error" role="alert">{{ state.error }}</p>
    <p v-if="state.notice" class="am-hint" role="status">{{ state.notice }}</p>
    <section v-if="state.candidate" class="am-import-preview">
      <div class="am-section-heading"><div><h4>{{ state.candidate.name }}</h4><p>{{ state.filename }} · Pet v{{ state.candidate.version }}</p></div>
        <div class="am-inline-actions"><VBtn variant="text" :disabled="state.busy" @click="controller.cancel">取消</VBtn><VBtn color="primary" variant="flat" :loading="state.busy" :disabled="disabled" @click="controller.save">保存到角色库</VBtn></div>
      </div>
      <MascotPreview :key="state.candidate.id" :config="previewConfig" />
    </section>
    <div v-if="pets?.length" class="am-import-grid">
      <div v-for="pet in pets" :key="pet.id" class="am-import-card">
        <button type="button" class="am-character" :class="{ 'am-character--selected': config.mascot === pet.id }" :aria-pressed="config.mascot === pet.id" :disabled="disabled || state.busy" @click="emit('select', pet.id)">
          <img :src="pet.icon" alt="" /><strong>{{ pet.name }}</strong><small>Pet v{{ pet.version }}</small>
        </button>
        <VBtn size="small" variant="text" color="error" :disabled="disabled || state.busy || savedId === pet.id" @click="state.removeId = pet.id">{{ savedId === pet.id ? '正在使用' : '移除' }}</VBtn>
      </div>
    </div>
    <p v-else-if="!state.candidate" class="am-hint">尚未导入角色。支持仅含 pet.json 和动画图的包，也支持包含素材子目录的完整包。</p>
    <div v-if="state.removeId" class="am-remove-confirm" role="alert">
      <span>移除「{{ pets.find(p => p.id === state.removeId)?.name }}」及其保存的素材？</span>
      <VBtn variant="text" :disabled="state.busy" @click="state.removeId = ''">取消</VBtn>
      <VBtn color="error" variant="tonal" :loading="state.busy" :disabled="disabled" @click="controller.remove">确认移除</VBtn>
    </div>
  </section>
</template>
