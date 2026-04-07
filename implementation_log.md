# CodeWalkers 实现日志

本文档用于记录 CodeWalkers (原 Lil Agents) 项目从原生 AppKit 重构为 Tauri 跨平台应用的逐步实现过程。

## 1. 项目初始化与环境检查 (已完成)
- [x] 使用 `npm create tauri-app@latest` (或同等命令) 初始化了 Tauri 项目，命名为 `CodeWalkers`。
- [x] 当前端技术栈已确定（观察目录结构有 `package.json`, `pnpm-lock.yaml`, `vite.svg`，推测使用了 Vite + Vue/React/Svelte 等）。
- [x] Tauri 开发服务器已在终端启动并运行中。

## 2. 第一阶段：基础框架与透明无边框窗口 (已完成)
- [x] 配置 Tauri `tauri.conf.json` 以实现窗口透明 (`"transparent": true`)、无边框 (`"decorations": false`)、置顶 (`"alwaysOnTop": true`)。
- [x] 添加了 macOS 特有的私有 API 配置 (`"macOSPrivateApi": true`) 支持透明效果。
- [x] 清理了前端默认模板代码 (删除了 Vite 默认 logo 等)。
- [x] 编写了前端基础结构：
  - CSS (`App.css`): 设置了 `body` 和 `:root` 背景为 `transparent`，添加了测试边框以便观察。
  - TSX (`App.tsx`): 增加了一个代表虚拟角色的 `div` 占位，以及一个基础的“思考气泡 (Bubble)”，带有简单的点击交互。

## 3. 第二阶段：底层进程与 IPC (已完成)
- [x] Rust 端探测本地 AI CLI (claude, codex 等)。(已完成 `providers.rs`)
- [x] 前端调用探测接口，并将已安装的 CLI 渲染到界面上。
- [x] Rust 端使用 `std::process::Command` 挂起子进程，实现长连接会话。(`session.rs` 提供 `start_session` 命令)
- [x] 前端发送指令 (`send_message`)，Rust 端透传给 CLI；CLI 输出通过事件 (`session_output`, `session_error`) 通知前端，并在前端调试面板展示。

## 4. 第三阶段：系统级交互与透明穿透 (已完成)
- [x] 配置 macOS 透明点击穿透 (`set_ignore_cursor_events`)，避免透明区域阻挡用户点击后方内容。
- [x] 在系统托盘 (System Tray) 添加常驻图标，允许右键点击退出应用。

## 5. 第四阶段：UI 完善与抛光 (已完成)
- [x] 重构应用布局为绝对定位 (Absolute Positioning)，支持通过鼠标自由拖拽小人。
- [x] 美化终端对话面板和 Provider 选择面板样式，增加了毛玻璃 (backdrop-filter) 与现代化聊天框输入 UI。
- [x] 实现了小人的基础闲置（呼吸动画）与行走（随机漫步与定时触发动画）状态机。

## 6. 与原版项目 (Lil Agents) 的功能对比与差异
### 已实现的核心功能 (MVP 级别)
- [x] **桌面虚拟陪伴**: 透明无边框窗口、置顶显示、鼠标自由拖拽。
- [x] **点击穿透**: 只有 UI 元素拦截鼠标事件，背景透明区域完全穿透。
- [x] **底层 CLI 驱动**: 探测系统 PATH 中的 AI CLI（Claude, Codex 等），并通过 `std::process::Command` 挂起子进程，实现长连接通信。
- [x] **AI 终端交互**: 提供了终端界面，可以发送指令并实时渲染 CLI 的 stdout/stderr 输出。
- [x] **系统托盘**: 提供了基础的 Mac 状态栏图标和退出功能。
- [x] **基础状态机**: 实现了随机漫步、呼吸动画和思考气泡。

### 尚未实现的高级功能 (原版中存在但当前 Tauri 版本未包含)
*注：目前大部分高级功能已在后续迭代中实现。*
1. **多显示器**：
   - 原版：可以自动探测多显示器，并将角色限制在 Dock 栏正上方行走。
   - 当前：只在当前主显示器沿屏幕底部行走。

## 7. 进一步的迭代 (最新进展)
- [x] **引入原版视频资源 (HEVC)**：将 Emoji 占位符替换为透明通道视频（Ethan/Luna）。
- [x] **高精度像素级透明点击穿透**：通过 Canvas 绘制视频帧获取鼠标位置的 Alpha 通道，实现精确的点击判断。
- [x] **Dock 栏吸附逻辑**：通过锁定角色的 Y 坐标为屏幕底部，实现沿屏幕底部的左右巡游。
- [x] **多角色切换**：可在终端面板右上角下拉菜单中切换 Ethan 和 Luna 角色。
- [x] **添加音效反馈**：在发送消息、接收输出以及完成巡游到达目的地时，触发随机音效 (`ping-aa.mp3` ~ `ping-hh.mp3`)。
- [x] **完善终端体验**：增加了 `/clear` 指令清空终端屏幕，并引入了 `Playful`, `Hacker`, `Monochrome` 三种主题。
4. **主题系统与多尺寸 (Theming & Resizing)**：
   - 原版：提供 Midnight, Peach, Cloud, Moss 等主题切换，支持 Large/Medium/Small 尺寸。
   - 当前：固定的 CSS 样式。
5. **快捷指令解析与自动更新**：
   - 原版：支持 `/clear`, `/copy` 等终端快捷指令；集成了 Sparkle 实现应用自动更新。
   - 当前：未实现快捷指令拦截；未集成 Tauri Updater。
6. **多实例/多 CLI 同时运行**：
   - 原版：可以在菜单栏独立开启/关闭不同的角色（对应不同的 CLI）。
   - 当前：全局单例的 `SessionState`，同一时间只能运行一个 CLI 会话。
