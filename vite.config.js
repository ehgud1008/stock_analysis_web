import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/history': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/ai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api': {
        // target: 'http://140.238.15.94:8080',
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
