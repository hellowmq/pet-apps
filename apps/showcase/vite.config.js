import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { portableBookmarkPlugin } from './portable-build.js';

export default defineConfig({
  base: './',
  plugins: [portableBookmarkPlugin()],
  // Reuse Maodie's owned frames in both the dev server and the static build.
  publicDir: fileURLToPath(new URL('../maodie/public', import.meta.url)),
  server: { port: 5175 },
  optimizeDeps: { include: ['three', 'gsap'] },
  build: {
    rollupOptions: {
      input: {
        showcase: fileURLToPath(new URL('./index.html', import.meta.url)),
        companion: fileURLToPath(new URL('./companion.html', import.meta.url)),
      },
    },
  },
});
