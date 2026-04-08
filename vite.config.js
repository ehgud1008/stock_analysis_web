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
        timeout: 120000,       // 120초 (Gemini 응답 대기)
        proxyTimeout: 120000,  // 프록시 자체 타임아웃
      },
      '/serv/compare': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
      '/api': {
        // target: 'http://140.238.15.94:8080',
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
