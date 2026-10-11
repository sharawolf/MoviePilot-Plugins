<script setup>
import PluginWorkspace from './PluginWorkspace.vue'
import { hostProps } from '../props.js'
defineProps(hostProps)
defineEmits(['close', 'layout'])
</script>

<template>
  <PluginWorkspace :key="pluginId" v-bind="$props" mode="page" @close="$emit('close')" @layout="$emit('layout', $event)" />
</template>
