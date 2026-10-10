import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, basename } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))
const runtimeFiles = ['runtime-BCybTabx.js', 'agentmascot-loader.js', 'provider-mBbtEwEX.js', 'plugin-entry.js', 'mascot-runtime.js', 'codex-pet.js']

export default defineConfig({
  // Federation 1.4.1 needs a root base to emit imports relative to remoteEntry.
  base: '/',
  plugins: [
    vue(),
    federation({
      name: 'AgentMascot', filename: 'remoteEntry.js',
      exposes: {
        './Config': './src/components/Config.vue',
        './Page': './src/components/Page.vue',
        './AppPage': './src/components/AppPage.vue',
        './PluginEntry': './src/plugin-entry.js',
      },
      shared: { vue: { requiredVersion: false, generate: false } },
    }),
    {
      name: 'preserve-mascot-runtime',
      generateBundle(_, bundle) {
        for (const filename of runtimeFiles) {
          this.emitFile({ type: 'asset', fileName: `assets/${filename}`, source: readFileSync(resolve(root, 'runtime', filename)) })
        }
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') output.code = output.code.replace(/[ \t]+(?=\r?$)/gm, '')
        }
      },
    },
  ],
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'esnext', minify: false,
    rollupOptions: {
      external: runtimeFiles.map(filename => `../runtime/${filename}`),
      output: { paths: id => runtimeFiles.includes(basename(id)) ? `./assets/${basename(id)}` : id },
    },
  },
})
