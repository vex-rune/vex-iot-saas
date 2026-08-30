import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { replaceHtmlTokens } from './replaceHtmlTokens';

/**
 * Vex 云物联 - 前端构建配置
 *
 * 官方站点域名: https://vexrune.top/   (对外展示 / SEO)
 * 控制台子域名:  即将上线,届时需要在此设置 `base` 与 Nginx 反代
 *                部署到官网域名的子路径 /console 下时,使用:
 *                base: '/console/',
 *                并配合 ops/nginx/nginx.conf 的 location /console/ 反代到本 SPA。
 *
 * https://vitejs.dev/config/
 */
export default defineConfig({
  plugins: [react(), replaceHtmlTokens()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-heroui': ['@heroui/react', '@heroicons/react'],
          'vendor-query': ['@tanstack/react-query', 'axios'],
        },
      },
    },
  },
});
