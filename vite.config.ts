import { defineConfig } from 'vite'

export default defineConfig({
  base: '/PayProcessor/',
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    include: ['sql.js'],
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        pay: './pay.html',
      },
    },
  },
})
