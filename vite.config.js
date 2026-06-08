import { defineConfig } from 'vite';

export default defineConfig({
  base: '/portfolio/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
