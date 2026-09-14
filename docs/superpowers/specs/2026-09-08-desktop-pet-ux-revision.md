# Desktop Pet UX Revision

**Date:** 2026-09-08  
**Status:** Approved  
**Amends:** `2026-09-08-desktop-pet-host-design.md`

## Problem

V1 桌宠像「透明小网页」居中抢屏：常驻按钮/标题/拖条，体量过大，拖拽不自然。

## Locked decisions

| Item | Choice |
|---|---|
| Interaction | **A**: 左键点 = 摸头；按住拖身体 = 移窗；辅助全进右键 |
| Default placement | 主屏工作区 **右下角**（边距 ~24px），记住上次位置 |
| Window size | ~**180×220**（贴宠物，非小 App） |
| Desktop chrome | **无**常驻 UI（无底栏、无标题、无亲密度角标、无拖条） |
| Secondary actions | 右键菜单 + 托盘 |
| Debug pages | `apps/tuanzi\|maodie` 保持 pageUi，行为不变 |

## Interaction detail

- **Click vs drag:** `pointerdown` 在宠物命中上记录点；移动超过 ~5px → 进入拖窗；`pointerup` 若未拖 → `pet.pet()`
- **Right-click:** 菜单项：摸头、喂食、跳跃、切换团子/耄耋、隐藏、退出
- **Click-through:** 仅宠物命中（及菜单弹出时）接收鼠标；其余穿透
- **Tray:** 显示/隐藏、切换、退出（与右键重叠可接受）

## Out of scope (still)

贴边吸附、全屏躲避、多屏策略、闲逛、开机启动、Tauri
