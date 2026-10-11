<script setup>
import PluginWorkspace from './PluginWorkspace.vue'
import { hostProps } from '../props.js'
defineProps(hostProps)
</script>

<template>
  <PluginWorkspace :key="pluginId" v-bind="$props" mode="app" />
</template>
