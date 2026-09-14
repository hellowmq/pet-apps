import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  root,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@pets/tuanzi': path.resolve(root, '../tuanzi/src/tuanziPet.js'),
      '@pets/maodie': path.resolve(root, '../maodie/src/maodiePet.js'),
    },
  },
  optimizeDeps: { include: ['three', 'gsap'] },
});
