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
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        // 放大 proxy 超时至 3 分钟，与 AI_TIMEOUT 对齐
        // 否则 Vite dev server 会在大模型返回前提前断开连接
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
    },
  },
})
