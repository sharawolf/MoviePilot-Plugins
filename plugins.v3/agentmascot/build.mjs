import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import { stampRevision } from './build-runtime.mjs'
const root = fileURLToPath(new URL('.', import.meta.url))
await build({ root })
await build({
  configFile: false, root,
  plugins: [{ name: 'stamp-mascot-runtime', renderChunk: code => ({ code: stampRevision(code), map: null }) }],
  build: {
    outDir: 'dist', emptyOutDir: false, target: 'es2020', minify: false,
    lib: { entry: fileURLToPath(new URL('src/global-entry.js', import.meta.url)), formats: ['iife'], name: 'AgentMascotLoader' },
    rollupOptions: { output: { entryFileNames: 'assets/agentmascot-loader.global.js' } },
  },
})
