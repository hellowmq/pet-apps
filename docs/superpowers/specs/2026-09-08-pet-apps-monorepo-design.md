# Pet Apps Monorepo Design

**Date:** 2026-09-08  
**Status:** Draft for review（已纳入可嵌入架构修订）  
**Source reference:** `/Users/wenmaoquan/WorkBuddy/WhatAboutThreeJs/pet-game` (unchanged对照)

## Goal

从现有 `pet-game` 抽出两条宠物支线，做成可独立运行的 app，并共享一层**可嵌入**薄内核；工作区独立于 WhatAboutThreeJs。V1 只交付两个整页 app，但内核按「任意 DOM 容器挂载」设计，方便后续变成网页小组件或浏览器插件 host，而不改宠物实现。

## Decisions (locked)

| Decision | Choice |
|---|---|
| Workspace layout | Monorepo：`apps/*` + `packages/pet-core` |
| Workspace path | `/Users/wenmaoquan/WorkBuddy/pet-apps` |
| Abstraction depth | `Pet` 接口 + 可嵌入 runtime（非配置驱动） |
| Embeddability (V1) | 架构预留：`createPetRuntime` 挂任意 DOM；UI 可插拔；不交付 widget/extension |
| Tooling | npm workspaces + Vite |
| Original pet-game | 保留不动，仅作对照 |

## Architecture

三层分离，避免「宠物逻辑」绑死「整页壳」：

```
┌─────────────────────────────────────────────┐
│ Host（V1 = 整页 app；未来 = widget / 插件）   │
│  选容器、选 UI 壳、选宠物、调 createPetRuntime │
├─────────────────────────────────────────────┤
│ @pet-apps/core                              │
│  createPetRuntime · particles · bond · ui?  │
├─────────────────────────────────────────────┤
│ Pet 实现（tuanzi / maodie）                   │
│  只认 scene / ctx API，不认 window 全屏假设   │
└─────────────────────────────────────────────┘
```

```
pet-apps/
├── package.json
├── packages/pet-core/           # @pet-apps/core
│   └── src/
│       ├── index.js
│       ├── createPetRuntime.js  # 挂到任意 container；场景/循环/指针/resize
│       ├── particles.js
│       ├── bond.js              # 纯状态；不绑 DOM（UI 通过回调订阅）
│       ├── hosts/
│       │   └── pageUi.js        # 整页奶油色壳（title/hint/bond/actions）
│       ├── ui.css               # page host 样式
│       └── pet.js               # Pet / PetContext / RuntimeOptions JSDoc
├── apps/tuanzi/
└── apps/maodie/
```

- 每个 app：独立 `index.html` / `vite.config.js` / `src/main.js`，可单独 `dev` / `build` / `preview`。
- App 的 `main.js` 只做 host：`createPetRuntime({ container, pet, ui: pageUi, ... })`。
- 共享逻辑只进 `pet-core`；宠物行为、素材、文案留在各自 app。
- 原 `WhatAboutThreeJs/pet-game` **不迁移、不删除**。

## Embeddability rules (V1 must follow)

1. **容器驱动尺寸**：renderer 尺寸取 `container.clientWidth/Height`（或 `ResizeObserver`），**不**假设 `window.innerWidth/Height` 即画布。整页 host 把 `#app` 设为 `100vw/100vh` 即可。
2. **指针坐标相对容器**：`pointer` NDC 用 canvas/container 的 bounding rect 换算，方便嵌入非全屏角标。
3. **UI 可插拔**：`ui` 可选。`null` / 省略 = 无 DOM 壳（未来 widget 可自绘或无按钮，只靠点击模型交互）。`pageUi` 是 V1 默认整页壳。
4. **bond 与 DOM 解耦**：`bond` 模块只维护数值 + `subscribe`；`pageUi` 订阅后更新 `#bond`。插件/小组件可另接自己的指示器。
5. **返回句柄**：`createPetRuntime` 返回 `{ dispose, getBond, canvas, scene }`，便于 host 卸载（SPA 路由、插件 teardown）。
6. **V1 不交付**：网页小组件 demo、浏览器扩展 manifest/content script（列在 Out of scope；目录与 API 已为其留位）。

## Pet interface

每个宠物实现同一约定（JSDoc 文档型；运行时为普通对象）：

```js
/**
 * @typedef {object} PetContext
 * @property {import('three').Scene} scene
 * @property {import('three').Camera} camera
 * @property {HTMLElement} container
 * @property {(n?: number) => void} addBond
 * @property {(origin: import('three').Vector3, count?: number) => void} burst
 */

/**
 * @typedef {object} Pet
 * @property {string} id
 * @property {string} title
 * @property {string} hint
 * @property {(ctx: PetContext) => void} mount
 * @property {(dt: number) => void} update
 * @property {() => void} dispose
 * @property {() => void} pet
 * @property {() => void} jump
 * @property {() => void} feed
 * @property {(raycaster: import('three').Raycaster) => boolean} [hitTest]
 * @property {(args: { pointer: {x:number,y:number}, raycaster, hit?: import('three').Vector3 }) => void} [onPointerMove]
 */

/**
 * @typedef {object} RuntimeOptions
 * @property {HTMLElement} container
 * @property {Pet} pet
 * @property {{ mount(el, api): { unmount(): void } } | null} [ui]
 * @property {number} [boundX]   // 相机适配活动半宽，默认 ~3.6
 * @property {string} [background]
 */
```

约定细则：

- `mount`：把网格/sprite 加进 `scene`，注册 idle 动画；**不**创建 renderer、**不**读 `window` 尺寸。
- `update(dt)`：由 runtime 每帧调用；状态机自洽。
- `dispose`：移除对象、杀 GSAP、释放自有几何/材质。
- `pet` / `jump` / `feed`：供 UI 或 host 调用；内部 `busy` 互斥。
- `hitTest` / `onPointerMove`：可选；坐标已是相对容器的 NDC。
- 单 runtime 只挂一只宠物；**不做运行时切换**。

## Bootstrap / data flow

```
apps/*/src/main.js          # Host: page
  → createPetRuntime({
        container: #app,
        pet: createTuanziPet() | createMaodiePet(),
        ui: pageUi,
        boundX, background
     })
      → ResizeObserver(container) → renderer size + fitCamera
      → particles + bond (state)
      → ui?.mount(container.parent or overlay root, { title, hint, bond, actions })
      → pet.mount(ctx)
      → loop: pet.update; particles; render
      → pointer (relative to canvas) → onPointerMove / hitTest → pet.pet()
```

- 亲密度与粒子由 core 提供；宠物只调用。
- `boundX`：耄耋传入原 `MD_BOUND` 量级，保证窄容器也能罩住漫游界。

## Per-app behavior (parity with pet-game)

### apps/tuanzi

- 程序化球体拼装：身体/耳/手/脚/眼/腮红/ω 嘴。
- 行为：`happyJump`（含大跳）、`feed`（饼干 + 咀嚼）、idle 呼吸/眨眼/耳抖。
- 输入：注意力跟随；点击命中摸头。

### apps/maodie

- Plane + 真帧贴图：`calm/walk/hiss/spider/ride`；假影子椭圆。
- 行为：漫走、随机跳、哈气、蜘蛛惊吓跳、喂食后骑车冲刺；指针靠近反向逃。
- 素材：从 `pet-game/public/maodie` 复制到 `apps/maodie/public/maodie`。

## UI / visuals

- V1 默认 host：`pageUi` + `ui.css`（奶油色标题/提示/❤/三按钮，**无**宠物切换条）。
- 整页 app 的 HTML 仅保留 `#app`（及可选静态挂点）；壳由 `pageUi.mount` 注入，便于同一 runtime 换壳。
- 技术栈：`three` + `gsap` + `vite`；ESM；无 TypeScript。

## Error handling & edge cases

- 宠物 `busy` 时忽略重复交互。
- 容器尺寸为 0 时跳过渲染一帧，等 ResizeObserver。
- 耄耋纹理加载失败不额外做 loading UI（YAGNI）。
- `dispose` 必须停 loop、disconnect observer、`ui.unmount`、`pet.dispose`。
- DPR 封顶 2；`dt` clamp `0.05`。

## Testing

- 手动：两 app 各自 `npm run dev -w apps/tuanzi` / `apps/maodie`，交互对齐原 pet-game。
- 构建：两 app `build` 无报错。
- 嵌入冒烟（可选手动）：临时把 `#app` 设为 `320×240` 固定角，确认画布与指针仍正确（验证容器驱动，不为 V1 产品形态）。
- 不强制单元测试；若后续加，优先 `bond` 与 runtime dispose。

## Out of scope (V1)

- 网页小组件 demo、浏览器扩展骨架
- 改造或删除原 `pet-game`
- 运行时多宠切换、配置驱动行为表
- TypeScript / pnpm / Turborepo
- 后端、账号、持久化亲密度

## Future hosts (not built now)

- **Widget：** 同一 `createPetRuntime`，`container` 为浮动 div；`ui` 用精简角标壳或 `null`。
- **Extension：** content script 注入 container；`dispose` 在插件卸载时调用；素材走 `chrome.runtime.getURL`（host 职责，不进 Pet）。

## Success criteria

1. `/Users/wenmaoquan/WorkBuddy/pet-apps` 可独立打开为 Cursor 工作区。
2. `apps/tuanzi`、`apps/maodie` 各自可启动，行为对齐原支线。
3. 共享能力在 `@pet-apps/core`；宠物专属代码不互相 import。
4. Runtime **不依赖**全屏 `window` 尺寸；UI 可关可换；返回可 `dispose`。
5. 原 `pet-game` 仍可原样运行。
6. 未交付 widget/extension，但换 host 时无需改 Pet 实现。
