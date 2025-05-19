import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/pixelhell/',
  server: {
    host: true
  },
  build: {
    sourcemap: true,
    // Force clear the cache
    emptyOutDir: true,
    // Generate unique file names to prevent caching
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
}); 