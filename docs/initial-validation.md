# Initial 首版准备记录

日期：2026-09-14。

## 本地准备

- 补充 Node.js 版本约定、依赖锁文件和统一构建 / 检查命令。
- 补充 Git 忽略规则、README 开发说明和 GitHub Actions 检查工作流。
- 目录尚未初始化 Git，没有分支、提交或远端；尚未创建 GitHub 仓库。

## 验证结果

- 首轮页面构建记录使用 Node.js 24.19.0、npm 10.2.4；本轮桌面验收使用 Node.js 24.19.0、npm 11.17.0。
- `npm run check` 通过：2 项亲密度单元测试，desktop / maodie / tuanzi 三个入口构建成功。
- 三个构建均有大于 500 KB 的 JavaScript 分块提示，尚未进行性能优化。
- 系统默认 Node 仍缺少 ICU 动态库；本次使用项目外的 Node.js 24.19.0 临时运行时（`/tmp/pet-apps-node24`），未修改系统 Node 配置。
- `npm ci` 的 Electron postinstall 下载长时间无输出后主动中止；随后使用同一锁文件执行 `npm ci --ignore-scripts --no-audit --no-fund`，并补齐 Electron 35.7.5 的 macOS arm64 本体。`node_modules/` 属于本地安装产物，不入库。
- `node_modules/.bin/electron --version` 返回 `v35.7.5`，`npm run desktop` 可正常构建并启动桌面窗口。
- GitHub Actions 配置尚未在 GitHub 执行。

## 桌面复现结果（2026-09-14）

通过 `npm run desktop` 启动 Electron 35.7.5，并使用本机桌面窗口逐项复现：

- [x] 透明悬浮窗口启动，默认显示团子。
- [x] 右键菜单切换团子 / 圆头耄耋，切换后画面和窗口尺寸变化正常。
- [x] 左键摸头；右键菜单中的摸头、喂食、跳跃均触发对应姿态 / 动画反馈。
- [x] 从宠物本体拖动窗口，位置从 `x=1160,y=646` 变为 `x=1220,y=666`。
- [x] 退出并重新启动后，位置恢复为 `x=1220,y=666`。
- [x] 空白区域右键不弹出宠物菜单；空白区域拖动不改变窗口位置，鼠标穿透成立。
- [ ] 托盘菜单和多屏幕边界仍未在本轮逐项复现；代码路径已存在，留待有第二块显示器时补测。

项目所有者已确认：团子是自己的素材，耄耋按互联网素材标注，当前彩色圆点托盘图标不存在本次发布阻碍。已记录于[素材来源说明](asset-sources.md)；代码采用 MIT License（见根目录 `LICENSE`），与素材归属分开处理。

## 下一步顺序

1. 在第二块显示器可用时补测托盘菜单和多屏幕边界行为。
2. 按 public、`master` 和现有项目名方案准备 GitHub 仓库，不需要重新命名项目。
3. 获得建仓授权后初始化 Git、提交 initial 版本、创建 GitHub 仓库并推送，核验远端文件和 Actions 运行结果。
4. 桌面源码运行验收通过后，再准备 macOS 应用打包；签名与发布作为后续阶段。
