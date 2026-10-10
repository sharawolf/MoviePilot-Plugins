<script setup>
import PluginWorkspace from './PluginWorkspace.vue'
import { hostProps } from '../props.js'
defineProps(hostProps)
defineEmits(['close', 'layout'])
</script>

<template>
  <PluginWorkspace :key="pluginId" v-bind="$props" mode="config" @close="$emit('close')" @layout="$emit('layout', $event)" />
</template>
