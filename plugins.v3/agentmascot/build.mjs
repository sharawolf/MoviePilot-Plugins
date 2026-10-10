import { build } from 'vite'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('.', import.meta.url))
await build({ root })
await build({
  configFile: false, root,
  build: {
    outDir: 'dist', emptyOutDir: false, target: 'es2020', minify: false,
    lib: { entry: fileURLToPath(new URL('src/global-entry.js', import.meta.url)), formats: ['iife'], name: 'AgentMascotLoader' },
    rollupOptions: { output: { entryFileNames: 'assets/agentmascot-loader.global.js' } },
  },
})
