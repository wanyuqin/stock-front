import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 所有 /api 开头的请求都转发到后端 :8888
      // 前端 baseURL = '/api/v1' → 实际请求 http://localhost:8888/api/v1/...
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        // 不重写路径：/api/v1/stocks → http://localhost:8888/api/v1/stocks ✓
      },
    },
  },
})
