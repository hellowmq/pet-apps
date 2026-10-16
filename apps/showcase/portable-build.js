import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const sourceId = 'virtual:petapp-portable-source';
const frameId = 'virtual:petapp-portable-frames';

// The bookmark carries its renderer and existing frames; no external host is needed.
export function portableBookmarkPlugin() {
  let source;
  return {
    name: 'petapp-portable-bookmark',
    resolveId(id) { if (id === sourceId) return '\0' + id; },
    async load(id) {
      if (id !== '\0' + sourceId) return;
      if (!source) source = buildPortableSource();
      return `export default ${JSON.stringify(await source)};`;
    },
  };
}

async function buildPortableSource() {
  const urls = ['maodie/calm.png'];
  for (const [name, count] of [['walk', 16], ['hiss', 13], ['spider', 14], ['ride', 4]]) {
    for (let i = 1; i <= count; i++) urls.push(`maodie/${name}/${i}.png`);
  }
  const images = [], indices = [], unique = new Map();
  for (const url of urls) {
    const bytes = readFileSync(new URL('../maodie/public/' + url, import.meta.url));
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (!unique.has(hash)) {
      unique.set(hash, images.length);
      images.push('data:image/png;base64,' + bytes.toString('base64'));
    }
    indices.push([url, unique.get(hash)]);
  }
  const result = await build({
    configFile: false, publicDir: false, logLevel: 'silent',
    resolve: { alias: { '@pet-apps/core': fileURLToPath(new URL('../../packages/pet-core/src/index.js', import.meta.url)) } },
    define: { 'import.meta.env.BASE_URL': JSON.stringify('./') },
    plugins: [{
      name: 'petapp-embedded-frames',
      resolveId(id) { if (id === frameId) return '\0' + id; },
      load(id) {
        if (id === '\0' + frameId) return `const images=${JSON.stringify(images)};export default Object.fromEntries(${JSON.stringify(indices)}.map(([path,i])=>[path,images[i]]));`;
      },
    }],
    build: {
      write: false, minify: 'esbuild', target: 'es2022',
      lib: { entry: fileURLToPath(new URL('./src/portable.js', import.meta.url)), name: 'PetAppPortable', formats: ['iife'] },
    },
    esbuild: { legalComments: 'inline' },
  });
  const output = Array.isArray(result) ? result[0].output : result.output;
  const license = readFileSync(new URL('../../node_modules/three/LICENSE', import.meta.url), 'utf8');
  return `/*! ${license.replace(/\*\//g, '* /')} */\n` + output.find(file => file.type === 'chunk' && file.isEntry).code;
}
