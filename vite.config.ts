import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// @vectorsize/woscillators ships as a bare IIFE (no module.exports, no export).
// This plugin intercepts the file and appends named ESM exports so
// `import { wosc } from '@vectorsize/woscillators'` works in Vite.
const woscillatorsEsmPlugin = {
  name: 'woscillators-esm',
  enforce: 'pre' as const,
  load(id: string) {
    if (id.includes('@vectorsize/woscillators/dist/index.js')) {
      const filePath = id.split('?')[0]   // strip ?v=... before filesystem read
      const code = readFileSync(filePath, 'utf-8')
      return (
        code +
        '\nexport const { wosc, params, oscillatorTypes } = woscillators;\nexport default woscillators;\n'
      )
    }
  },
}

export default defineConfig({
  plugins: [woscillatorsEsmPlugin, react()],
  optimizeDeps: {
    // Exclude so Vite's esbuild pre-bundler doesn't process it before
    // our plugin can patch it with ESM exports.
    exclude: ['@vectorsize/woscillators'],
  },
})
