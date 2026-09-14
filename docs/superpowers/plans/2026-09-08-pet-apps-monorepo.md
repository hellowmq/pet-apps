# Pet Apps Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/Users/wenmaoquan/WorkBuddy/pet-apps` 建成 npm workspaces monorepo：`@pet-apps/core` 提供可嵌入 `createPetRuntime`，以及可独立运行的 `apps/tuanzi` 与 `apps/maodie`。

**Architecture:** Host（整页 app）调用 `createPetRuntime({ container, pet, ui })`；core 负责容器尺寸、场景、粒子、bond 状态、可选 pageUi；各宠物实现 `Pet` 接口，不假设全屏 `window`。原 `WhatAboutThreeJs/pet-game` 只读对照，不修改。

**Tech Stack:** npm workspaces, Vite 6, three ^0.178, gsap ^3.12, ESM, 无 TypeScript；vitest 仅测 bond。

## Global Constraints

- Workspace path: `/Users/wenmaoquan/WorkBuddy/pet-apps`
- Package name for core: `@pet-apps/core`
- Apps: `apps/tuanzi`, `apps/maodie` — each independently `dev` / `build` / `preview`
- Runtime sizes and pointer NDC from **container** (ResizeObserver), not raw window as canvas size
- UI pluggable; V1 uses `pageUi`; bond is DOM-decoupled (`subscribe`)
- `createPetRuntime` returns `{ dispose, getBond, canvas, scene }`
- No pet switcher; one pet per app
- Do not modify `/Users/wenmaoquan/WorkBuddy/WhatAboutThreeJs/pet-game`
- No widget/extension hosts in V1
- Vite `base: '/'` for standalone apps (not `/pet/`)

---

## File Structure

```
pet-apps/
├── package.json
├── .gitignore
├── packages/pet-core/
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── pet.js
│   │   ├── bond.js
│   │   ├── particles.js
│   │   ├── createPetRuntime.js
│   │   ├── hosts/pageUi.js
│   │   └── ui.css
│   └── tests/bond.test.js
├── apps/tuanzi/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.js
│       └── tuanziPet.js
└── apps/maodie/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── public/maodie/…          # copied from pet-game
    └── src/
        ├── main.js
        └── maodiePet.js
```

---

### Task 1: Monorepo scaffold + bond module

**Files:**
- Create: `.gitignore`
- Create: `package.json` (root)
- Create: `packages/pet-core/package.json`
- Create: `packages/pet-core/src/pet.js`
- Create: `packages/pet-core/src/bond.js`
- Create: `packages/pet-core/src/index.js` (partial exports)
- Create: `packages/pet-core/tests/bond.test.js`
- Create: `packages/pet-core/vitest.config.js`

**Interfaces:**
- Produces: `createBond()` → `{ getBond, addBond, subscribe, dispose }`
- Produces: JSDoc types in `pet.js` (documentation only)

- [ ] **Step 1: Write root + core package files**

`.gitignore`:
```
node_modules
dist
.DS_Store
*.local
```

Root `package.json`:
```json
{
  "name": "pet-apps",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:tuanzi": "npm run dev -w @pet-apps/tuanzi",
    "dev:maodie": "npm run dev -w @pet-apps/maodie",
    "build:tuanzi": "npm run build -w @pet-apps/tuanzi",
    "build:maodie": "npm run build -w @pet-apps/maodie",
    "test": "npm run test -w @pet-apps/core"
  }
}
```

`packages/pet-core/package.json`:
```json
{
  "name": "@pet-apps/core",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.js",
  "exports": {
    ".": "./src/index.js",
    "./ui.css": "./src/ui.css"
  },
  "scripts": {
    "test": "vitest run"
  },
  "peerDependencies": {
    "three": "^0.178.0",
    "gsap": "^3.12.5"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "three": "^0.178.0",
    "gsap": "^3.12.5"
  }
}
```

- [ ] **Step 2: Write failing bond test**

`packages/pet-core/tests/bond.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { createBond } from '../src/bond.js';

describe('createBond', () => {
  it('starts at 0 and notifies subscribers on addBond', () => {
    const bond = createBond();
    const spy = vi.fn();
    bond.subscribe(spy);
    expect(bond.getBond()).toBe(0);
    bond.addBond(2);
    expect(bond.getBond()).toBe(2);
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('unsubscribe stops notifications', () => {
    const bond = createBond();
    const spy = vi.fn();
    const unsub = bond.subscribe(spy);
    unsub();
    bond.addBond(1);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

`packages/pet-core/vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `cd /Users/wenmaoquan/WorkBuddy/pet-apps && npm install && npm test`  
Expected: FAIL (module not found or export missing)

- [ ] **Step 4: Implement bond + pet.js stubs + index**

`packages/pet-core/src/bond.js`:
```js
export function createBond(initial = 0) {
  let value = initial;
  const subs = new Set();
  return {
    getBond: () => value,
    addBond(n = 1) {
      value += n;
      for (const fn of subs) fn(value);
      return value;
    },
    subscribe(fn) {
      subs.add(fn);
      fn(value);
      return () => subs.delete(fn);
    },
    dispose() { subs.clear(); },
  };
}
```

`packages/pet-core/src/pet.js`: JSDoc typedefs for `Pet`, `PetContext`, `RuntimeOptions` matching the design spec (no runtime code).

`packages/pet-core/src/index.js`:
```js
export { createBond } from './bond.js';
```

- [ ] **Step 5: Run test — expect PASS**

Run: `npm test`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json packages/pet-core
git commit -m "chore: scaffold monorepo and bond module"
```

---

### Task 2: particles + createPetRuntime + pageUi

**Files:**
- Create: `packages/pet-core/src/particles.js`
- Create: `packages/pet-core/src/createPetRuntime.js`
- Create: `packages/pet-core/src/hosts/pageUi.js`
- Create: `packages/pet-core/src/ui.css`
- Modify: `packages/pet-core/src/index.js`

**Interfaces:**
- Consumes: `createBond` from Task 1
- Produces: `createParticles(scene)` → `{ burst, update, dispose }`
- Produces: `createPetRuntime(options)` → `{ dispose, getBond, canvas, scene }`
- Produces: `pageUi` with `mount(parent, api)` → `{ unmount() }`
- `api` for pageUi: `{ title, hint, getBond, subscribeBond, onPet, onJump, onFeed }`

- [ ] **Step 1: Implement particles.js**

Port heart InstancedMesh pool from `pet-game/src/main.js` (MAX_PARTICLES=120, gravity, shrink). Export `createParticles(scene)` returning `{ burst(origin, count), update(dt), dispose() }`.

- [ ] **Step 2: Implement createPetRuntime.js**

Required behavior:
- Append WebGL canvas to `options.container`
- Scene background from `options.background` default `#fdf6ec`, fog matching
- Ambient + directional light + circle ground ShadowMaterial (as pet-game)
- Camera PerspectiveCamera(38), fitCamera using `options.boundX` default `3.6`
- Size via `ResizeObserver` on container; `renderer.setSize(w,h)`; skip render if w/h === 0
- Pointer: NDC from `canvas.getBoundingClientRect()`
- Wire `pet.mount(ctx)` with `{ scene, camera, container, addBond, burst }`
- Loop: `pet.update(dt)`, `particles.update(dt)`, `render`
- Optional `ui.mount` on `container.parentElement || container`
- `dispose`: cancel loop, disconnect observer, ui.unmount, pet.dispose, particles.dispose, bond.dispose, remove canvas, dispose renderer

- [ ] **Step 3: Implement pageUi.js + ui.css**

Port cream UI from pet-game `index.html` styles (no `.pets` switcher). Inject `.ui`, `.hearts`, `.actions` into parent. Bind buttons to `onPet` / `onJump` / `onFeed`. Subscribe bond for `#bond` text. `unmount` removes injected nodes and unsubscribes.

- [ ] **Step 4: Export from index.js**

```js
export { createBond } from './bond.js';
export { createParticles } from './particles.js';
export { createPetRuntime } from './createPetRuntime.js';
export { pageUi } from './hosts/pageUi.js';
```

Also ensure peer deps: apps will depend on `three` and `gsap`; core imports them as peer.

- [ ] **Step 5: Smoke-check syntax**

Run: `node --check packages/pet-core/src/createPetRuntime.js` (and other new files)  
Expected: no output / exit 0

- [ ] **Step 6: Commit**

```bash
git add packages/pet-core
git commit -m "feat(core): add embeddable createPetRuntime and pageUi"
```

---

### Task 3: apps/tuanzi

**Files:**
- Create: `apps/tuanzi/package.json`
- Create: `apps/tuanzi/vite.config.js`
- Create: `apps/tuanzi/index.html`
- Create: `apps/tuanzi/src/tuanziPet.js`
- Create: `apps/tuanzi/src/main.js`

**Interfaces:**
- Consumes: `createPetRuntime`, `pageUi` from `@pet-apps/core`
- Produces: `createTuanziPet()` → Pet object

- [ ] **Step 1: Scaffold tuanzi app**

`apps/tuanzi/package.json`:
```json
{
  "name": "@pet-apps/tuanzi",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@pet-apps/core": "*",
    "gsap": "^3.12.5",
    "three": "^0.178.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

`vite.config.js`:
```js
import { defineConfig } from 'vite';
export default defineConfig({
  base: '/',
  server: { port: 5173 },
  optimizeDeps: { include: ['three', 'gsap'] },
});
```

`index.html`: minimal shell — `#app` full viewport + import `@pet-apps/core/ui.css` + `/src/main.js`. Title: `团子 · Three.js 桌面宠物`.

- [ ] **Step 2: Port tuanziPet.js**

Extract from pet-game all 团子-only logic: mesh assembly, happyJump, feed, idle blink/breath/ears, attention system in `update`/`onPointerMove`/`hitTest`. Factory `createTuanziPet()` returns Pet with `id: 'tuanzi'`, Chinese title/hint from PET_META.

- [ ] **Step 3: Wire main.js**

```js
import { createPetRuntime, pageUi } from '@pet-apps/core';
import '@pet-apps/core/ui.css';
import { createTuanziPet } from './tuanziPet.js';

const container = document.querySelector('#app');
createPetRuntime({
  container,
  pet: createTuanziPet(),
  ui: pageUi,
  boundX: 2.5,
  background: '#fdf6ec',
});
```

- [ ] **Step 4: Install & build**

Run: `npm install && npm run build:tuanzi`  
Expected: Vite build succeeds

- [ ] **Step 5: Manual/dev check**

Run: `npm run dev:tuanzi` — verify 摸头/跳跃/喂食/眼神跟随 (or rely on build + code review if headless)

- [ ] **Step 6: Commit**

```bash
git add apps/tuanzi package-lock.json
git commit -m "feat(tuanzi): standalone app on createPetRuntime"
```

---

### Task 4: apps/maodie

**Files:**
- Create: `apps/maodie/package.json`
- Create: `apps/maodie/vite.config.js`
- Create: `apps/maodie/index.html`
- Create: `apps/maodie/src/maodiePet.js`
- Create: `apps/maodie/src/main.js`
- Copy: `apps/maodie/public/maodie/**` from `WhatAboutThreeJs/pet-game/public/maodie`

**Interfaces:**
- Consumes: `createPetRuntime`, `pageUi`
- Produces: `createMaodiePet()` → Pet

- [ ] **Step 1: Scaffold + copy assets**

```bash
mkdir -p apps/maodie/public
cp -R /Users/wenmaoquan/WorkBuddy/WhatAboutThreeJs/pet-game/public/maodie \
  /Users/wenmaoquan/WorkBuddy/pet-apps/apps/maodie/public/maodie
```

Package/vite/html analogous to tuanzi; port `5174`; title `圆头耄耋 · Three.js 桌面宠物`.

- [ ] **Step 2: Port maodiePet.js**

All 耄耋 logic: textures via `import.meta.env.BASE_URL`, forms, hiss/scareJump/feed/ride, physics update, scare on pointer, hitTest on plane. `bound` activity half-width `3.6` used internally for walk limits.

- [ ] **Step 3: Wire main.js with boundX: 3.6**

- [ ] **Step 4: Install & build**

Run: `npm run build:maodie`  
Expected: success

- [ ] **Step 5: Commit**

```bash
git add apps/maodie package-lock.json
git commit -m "feat(maodie): standalone sprite pet app"
```

---

### Task 5: Root README + verify both apps + embed smoke note

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Document: install, `npm run dev:tuanzi` / `dev:maodie`, architecture layers, that runtime is container-embeddable, original pet-game path for对照, V1 no widget/extension yet.

- [ ] **Step 2: Final verification**

```bash
npm test
npm run build:tuanzi
npm run build:maodie
```

Expected: all pass / succeed

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add pet-apps README"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| npm workspaces monorepo path | 1 |
| createBond DOM-decoupled | 1 |
| createPetRuntime container-driven | 2 |
| pageUi pluggable + ui.css | 2 |
| dispose handle | 2 |
| apps/tuanzi parity | 3 |
| apps/maodie + assets | 4 |
| README / success criteria | 5 |
| No change to original pet-game | all |
| No widget/extension V1 | all (out of scope) |
