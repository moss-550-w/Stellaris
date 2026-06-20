import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import glsl from 'vite-plugin-glsl';
import { fileURLToPath, URL } from 'node:url';

// base 使用相对路径，兼容 GitHub Pages 子路径部署与纯静态/离线运行
export default defineConfig({
  base: './',
  plugins: [vue(), glsl()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 物理引擎 Worker 以 ES Module 形式打包
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
