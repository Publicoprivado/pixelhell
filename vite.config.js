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
    // Disable minification for debugging
    minify: false,
    // Prevent tree-shaking
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      // Preserve everything - no tree shaking
      treeshake: false
    },
    // Ensure THREE.js and our systems are preserved
    commonjsOptions: {
      include: [/three/, /node_modules/, /systems/]
    }
  },
  optimizeDeps: {
    include: ['three']
  }
}); 