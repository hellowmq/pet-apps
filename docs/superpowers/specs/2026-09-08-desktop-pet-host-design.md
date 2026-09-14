# Desktop Pet Host Design

**Date:** 2026-09-08  
**Status:** Draft for review  
**Depends on:** `docs/superpowers/specs/2026-09-08-pet-apps-monorepo-design.md`  
**Workspace:** `/Users/wenmaoquan/WorkBuddy/pet-apps`

## Goal

把团子 / 圆头耄耋挂到**系统桌面**上，体验对齐 Codex Pets：透明置顶悬浮层、可拖、空区点击穿透；**不以浏览器 localhost 端口作为主交付方式**。

## Decisions (locked)

| Decision | Choice |
|---|---|
| Shell | Electron（先落地） |
| Layout | 单一共享壳 `apps/desktop`，托盘切换宠物 |
| Page apps | `apps/tuanzi` / `apps/maodie` 保留作调试，不默认打开浏览器 |
| Future | Spec 预留 Tauri 迁移；本轮不实现 |
| Runtime | 继续用 `@pet-apps/core` 的 `createPetRuntime`（容器驱动） |

## Architecture

```
apps/desktop/                 # Electron host（正式入口）
  electron/
    main.js                   # BrowserWindow: transparent, frameless, alwaysOnTop
    preload.js                # drag / tray / pet-switch IPC
  renderer/
    index.html
    main.js                   # createPetRuntime + desktopUi + 切换宠物
    desktopUi.js              # 迷你按钮 + 拖拽条（非 pageUi 整页壳）
packages/pet-core/            # 不变契约；可选补 desktop 点击穿透辅助
apps/tuanzi, apps/maodie      # 调试页 only
```

数据流：

```
Electron main
  → 透明小窗加载 renderer（file:// 或 vite-plugin 打包资源，无对外端口依赖）
renderer
  → createPetRuntime({ container, pet, ui: desktopUi })
托盘 / IPC
  → dispose → createTuanziPet | createMaodiePet → remount
```

开发期可用 Vite 给 renderer 热更新，但**用户心智入口是桌面 App**，不是「打开某个端口」。

## Window behavior

- **尺寸**：默认约 `320×400`；可后续加缩放，V1 固定即可。
- **样式**：`frame: false`，`transparent: true`，`alwaysOnTop: true`，`hasShadow: false`（或轻阴影），背景 CSS `transparent`。
- **拖拽**：顶部细条或宠物非按钮区域触发 `window.move`（`-webkit-app-region: drag` 或 IPC `startDrag`）。
- **点击穿透**：窗口默认对透明像素 `setIgnoreMouseEvents(true, { forward: true })`；指针进入宠物/UI 命中区时关闭穿透（对齐 Codex overlay 思路）。
- **交互**：点宠物 = `pet.pet()`；迷你三键 = 摸头 / 喂食 / 跳跃；亲密度用小角标，不占满屏 UI。
- **托盘**：显示/隐藏、切换团子↔耄耋、退出。
- **关闭**：V1 托盘「退出」即可；可选「隐藏到托盘」（非必须）。

## Desktop UI (not pageUi)

- 不用整页奶油标题栏作为桌面主 UI（挡视线）。
- `desktopUi`：右下角或底部小 pill 三按钮 + 可选 ❤ 数字；尽量小。
- `pageUi` 仍留给调试页 `apps/tuanzi|maodie`。

## Pet switching

1. `runtime.dispose()`
2. `pet = createTuanziPet()` 或 `createMaodiePet()`
3. 新 `createPetRuntime(...)`（或 runtime 支持 `swapPet`——V1 用 dispose+重建更简单）

素材：耄耋 PNG 由 desktop renderer 静态资源目录提供（从 `apps/maodie/public/maodie` 复用/拷贝）。

## Packaging & scripts

```bash
npm run desktop          # 启动 Electron 桌面宠
npm run desktop:build    # 可选：electron-builder 打 macOS 包（V1 可先能跑再打包）
npm run dev:tuanzi       # 调试页（可选）
npm run dev:maodie
```

V1 成功标准以 **`npm run desktop` 弹出桌面悬浮宠`** 为准；installer 可二期。

## Tauri migration notes (not in V1)

- Renderer 页面（`createPetRuntime` + `desktopUi` + 宠物工厂）可原样迁入 Tauri webview。
- 需重写：透明窗口、置顶、托盘、点击穿透 API（Tauri window 插件）。
- Electron 体积代价已知；迁移触发条件：需要明显更小的分发包。

## Out of scope (V1)

- Tauri 实现
- 浏览器插件 / 网页小组件
- Codex 式任务状态绑定（本宠是互动桌宠，不做 agent 进度条）
- 多显示器高级吸附、自动躲避最大化窗口
- 完整 installer 公证 / 自动更新

## Success criteria

1. `npm run desktop` 在 macOS 上出现透明置顶可拖宠物，不依赖用户手动打开浏览器端口。
2. 托盘可切换团子 / 耄耋；摸头/喂食/跳跃可用。
3. 透明空区尽量不挡住下层点击（命中区外穿透）。
4. 现有 `createPetRuntime` / Pet 实现无需为桌面重写逻辑；仅新增 desktop host + desktopUi。
5. Spec / README 写明 Tauri 为后续选项。
