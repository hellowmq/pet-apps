# Desktop Pet Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Electron 共享壳把团子/耄耋挂到 macOS 桌面（透明置顶、可拖、托盘切换），入口为 `npm run desktop`，不以浏览器端口为主交付。

**Architecture:** `apps/desktop` = Electron main + Vite renderer；renderer 调用 `createPetRuntime` + 精简 `desktopUi`；从现有 app 复用 `createTuanziPet` / `createMaodiePet`；core 增加透明场景选项与 hover IPC 钩子。

**Tech Stack:** Electron 35+, Vite 6, three, gsap, 现有 `@pet-apps/core`

## Global Constraints

- Workspace: `/Users/wenmaoquan/WorkBuddy/pet-apps`
- Single shell `apps/desktop`; tray switches pets
- Window ~320×400; `frame:false`, `transparent:true`, `alwaysOnTop:true`
- Click-through outside pet/UI hit region
- Reuse Pet factories; no Tauri / installer in V1
- Page apps remain debug-only

---

## File Structure

```
apps/desktop/
  package.json
  electron/main.js
  electron/preload.js
  index.html
  vite.config.js
  public/maodie/…          # copy from apps/maodie/public
  src/
    main.js
    desktopUi.js
    pets.js                # re-export factories + switch helper
packages/pet-core/src/createPetRuntime.js   # alpha / transparent / onHoverChange
README.md                  # desktop-first docs
```

---

### Task 1: Core transparent + hover hook

**Files:**
- Modify: `packages/pet-core/src/createPetRuntime.js`

**Interfaces:**
- `RuntimeOptions.transparent?: boolean` — alpha canvas, `scene.background=null`, no fog (or fog off)
- `RuntimeOptions.onHoverChange?: (hovering: boolean) => void` — true when pet hitTest or UI interactive

- [ ] **Step 1:** If `transparent`, `WebGLRenderer({ alpha: true })`, `scene.background = null`, skip fog, ground ShadowMaterial keep or reduce opacity.
- [ ] **Step 2:** In pointermove, call `onHoverChange(hitTest || false)`; also true when pointer over `.pet-desktop-ui` / `.pet-page-actions` (query from event target).
- [ ] **Step 3:** `npm test` still passes; commit.

```bash
git commit -m "feat(core): transparent runtime and hover callback"
```

---

### Task 2: Electron shell + desktopUi + pet switch

**Files:**
- Create: `apps/desktop/package.json`, `electron/main.js`, `electron/preload.js`, `vite.config.js`, `index.html`, `src/main.js`, `src/desktopUi.js`, `src/pets.js`
- Copy: `public/maodie` from maodie app
- Modify: root `package.json` scripts + README

**Interfaces:**
- preload: `window.desktopPet = { setIgnoreMouse(ignore), onSetPet(cb), getPet(), show/hide helpers }`
- main: tray menu 团子/耄耋/显示/退出；IPC `pet:set-ignore-mouse`, `pet:switch`
- `desktopUi.mount` → mini pills + bond badge; class `pet-desktop-ui`

- [ ] **Step 1:** Scaffold Electron window (transparent, alwaysOnTop, 320×400), load Vite dev URL in `ELECTRON_DEV` else `dist/index.html`.
- [ ] **Step 2:** Implement click-through via `setIgnoreMouseEvents` driven by renderer `onHoverChange`.
- [ ] **Step 3:** Drag region: top bar `-webkit-app-region: drag`; buttons `no-drag`.
- [ ] **Step 4:** Renderer mounts tuanzi by default; tray IPC switches dispose+remount maodie/tuanzi with correct `boundX` / assets `BASE_URL`.
- [ ] **Step 5:** Root script `"desktop": "npm run desktop -w @pet-apps/desktop"` where workspace script runs `vite build && electron .` (or `concurrently` vite+electron for dev — V1: build then electron is OK for reliability).

Preferred V1 launch (reliable, no port mental model for users):

```json
"scripts": {
  "desktop": "vite build && electron .",
  "desktop:dev": "vite build --watch & electron ."
}
```

Actually use: `"desktop": "vite build && electron electron/main.js"` with proper paths.

- [ ] **Step 6:** Run `npm run desktop`, verify window appears; commit.

```bash
git commit -m "feat(desktop): Electron overlay host with tray pet switch"
```

---

### Task 3: README + verify

- [ ] Update README: primary entry `npm run desktop`; debug pages secondary; Tauri note.
- [ ] `npm test && npm run build:tuanzi && npm run build:maodie && npm run desktop` (launch briefly / build desktop renderer).
- [ ] Commit docs.

---

## Spec coverage

| Requirement | Task |
|---|---|
| Electron transparent alwaysOnTop | 2 |
| Tray switch pets | 2 |
| Click-through | 1+2 |
| createPetRuntime reuse | 1+2 |
| No browser-port as primary | 2+3 |
| Tauri deferred note | 3 |
