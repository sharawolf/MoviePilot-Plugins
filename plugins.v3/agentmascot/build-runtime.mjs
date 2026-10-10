import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const runtimeFiles = ['runtime-BCybTabx.js', 'agentmascot-loader.js', 'provider-mBbtEwEX.js', 'plugin-entry.js', 'mascot-runtime.js', 'codex-pet.js']
const digest = createHash('sha256')
for (const name of runtimeFiles) digest.update(name).update(readFileSync(new URL(`runtime/${name}`, import.meta.url)))
export const runtimeRevision = digest.digest('hex').slice(0, 16)
export const stampRevision = code => code.replaceAll('__AGENTMASCOT_RUNTIME_REVISION__', runtimeRevision)
export function stampRuntime(code) {
  for (const name of runtimeFiles) {
    for (const quote of ["'", '"']) code = code.replaceAll(`${quote}./${name}${quote}`, `${quote}./${name}?v=${runtimeRevision}${quote}`)
  }
  return stampRevision(code)
}
