import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/pixelhell/',
  server: {
    host: true
  }
});