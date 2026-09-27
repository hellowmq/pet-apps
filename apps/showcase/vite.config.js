import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Reuse Maodie's owned frames in both the dev server and the static build.
  publicDir: fileURLToPath(new URL('../maodie/public', import.meta.url)),
  server: { port: 5175 },
  optimizeDeps: { include: ['three', 'gsap'] },
});
