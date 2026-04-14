import { defineConfig } from 'vite'

export default defineConfig({
  base: '/PayProcessor/',
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    include: ['sql.js'],
  },
})
