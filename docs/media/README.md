# README 媒体说明

## 当前文件

- `tuanzi-canvas.png`：由 Electron `webContents.capturePage()` 导出的真实 renderer 画布截图。
- `tuanzi-canvas.gif`：由同一个 renderer canvas 的 `canvas.captureStream()` + `MediaRecorder` 导出，再用本机 `ffmpeg` 转换为 GIF。
- `maodie-canvas.png`：由 Electron `webContents.capturePage()` 导出的真实 renderer 画布截图。
- `maodie-canvas.gif`：由同一个 renderer canvas 的 `canvas.captureStream()` + `MediaRecorder` 导出，再用本机 `ffmpeg` 转换为 GIF。

这些文件都只包含应用自己的渲染画布，不包含系统桌面、其他应用窗口或用户文件。GIF 不是系统屏幕录制，也不能证明托盘原生菜单的视觉样式。

## 重新生成

在仓库根目录运行：

```bash
npm run capture:desktop
npm run capture:desktop -- --maodie
```

该命令会先构建 `apps/desktop`，生成媒体后删除临时 WebM。需要 Node.js 22+ 和本机 `ffmpeg`；它不调用 macOS 屏幕捕捉权限。

## 发布边界

- 团子画面对应 `apps/tuanzi/src/tuanziPet.js` 的项目自有程序化实现。
- 圆头耄耋画面对应 `apps/maodie/public/maodie/` 中由项目所有者确认归其本人所有的 PNG 序列帧。
- 原生托盘菜单由 Electron `Menu` 绘制，不属于 renderer canvas；本次不提交托盘截图。
