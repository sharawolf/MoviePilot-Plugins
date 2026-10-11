<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { startAgentMascotStage } from '../runtime.js'

const props = defineProps({
  agent: { type: Object, required: true },
  pet: { type: Object, required: true },
  api: { type: Object, required: true },
  pluginId: { type: String, required: true },
})
const container = ref(null)
const failure = shallowRef(null)
let handle
// Forward asynchronous config/image failures through Vue to the host's fallback.
const healthy = computed(() => {
  if (failure.value) throw failure.value
  return true
})
onMounted(() => {
  handle = startAgentMascotStage(container.value, {
    api: props.api, pluginId: props.pluginId, agent: props.agent, pet: props.pet,
    onError: error => { failure.value = error },
  })
})
onBeforeUnmount(() => handle?.stop())
</script>

<template>
  <div v-if="healthy" ref="container" class="agentmascot-stage" style="position: fixed; inset: 0; pointer-events: none" />
</template>
