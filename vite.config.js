import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      usePolling: true
    },
    proxy: {
      '/socket.io': {
        target: 'http://server:3000',
        changeOrigin: true,
        ws: true
      },
      '/api': {
        target: 'http://server:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})