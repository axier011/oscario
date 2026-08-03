import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': { target: 'http://192.168.1.26:8000', changeOrigin: true },
      '/ws':  { target: 'ws://192.168.1.26:8000', ws: true },
    },
  },
  build: { outDir: '../dist', emptyOutDir: true },
})
