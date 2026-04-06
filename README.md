<div align="center">
  <img src="./public/tauri.svg" width="150" alt="CodeWalkers Logo" />
  <h1>CodeWalkers</h1>
  <p><strong>A Desktop Virtual Companion powered by Tauri + React + Rust</strong></p>

  [![CI](https://github.com/yourusername/CodeWalkers/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/CodeWalkers/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Tauri](https://img.shields.io/badge/Tauri-v2.0-24C8DB?logo=tauri)](https://tauri.app/)
  [![React](https://img.shields.io/badge/React-v19-61DAFB?logo=react)](https://react.dev/)
</div>

---

## 📖 项目简介 (Introduction)

**CodeWalkers** 是一个跨平台的桌面虚拟陪伴助手。它会在你的电脑屏幕下方（Dock 栏上）自由漫步，并随时准备通过内置的终端与你进行交互。

本项目基于强大的 **Tauri v2** 架构，使用 **Rust** 编写高性能、低资源占用的后端逻辑，使用 **React + TypeScript** 构建精美的透明前端界面。它是原版 `Lil Agents` 概念的全面现代化、跨平台复刻与升级版。

### ✨ 核心特性 (Key Features)

- **🏃‍♂️ 桌面虚拟陪伴**：角色会在屏幕下方自由漫游，有真实的行走动画与休息状态。
- **🖱️ 像素级点击穿透**：采用高精度 Canvas Alpha 检测技术。点击角色实体时可以拖拽，点击角色旁边的透明区域时，鼠标事件会完美穿透到你的桌面或后面的软件。
- **🖥️ 沉浸式 AI 终端 (PTY)**：内置基于 `portable-pty` 的真实系统终端会话，完美集成 Gemini CLI，你可以直接在应用内发送消息，并得到实时的思考气泡和打字机反馈。
- **🎵 原生音效反馈**：发送消息、接收回复以及角色巡游到达终点时，都会有清脆的提示音。
- **🎨 多角色与主题系统**：
  - 支持一键切换角色（Bruce / Jazz）。
  - 支持四种不同的终端主题风格：`Midnight` (默认)、`Peach`、`Cloud`、`Moss`。
- **🚀 极低资源占用**：得益于 Tauri 和 Rust 的组合，它的内存占用极小，相比 Electron 更加轻量。

---

## 🛠️ 安装与运行 (Getting Started)

### 环境要求 (Prerequisites)

- [Node.js](https://nodejs.org/) (版本 >= 22.0.0)
- [pnpm](https://pnpm.io/) (版本 >= 10.0.0) - **本项目严格限制仅使用 pnpm**
- [Rust](https://www.rust-lang.org/) (最新稳定版)

### 本地开发 (Development)

1. 克隆项目到本地：
   ```bash
   git clone <your-repo-url>
   cd CodeWalkers
   ```

2. 安装依赖：
   ```bash
   # 必须使用 pnpm，使用 npm 或 yarn 会被拦截
   pnpm install
   ```

3. 环境变量配置 (可选)：
   如果你需要使用内置的 Gemini CLI 助手功能，请在根目录创建一个 `.env` 文件并填入你的 API Key：
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. 启动开发服务器：
   ```bash
   pnpm tauri dev
   ```
   > 首次启动时，Rust 编译器会下载并编译依赖，可能需要花费几分钟时间。之后的启动会非常快。

### 构建发布版本 (Build)

如果你想打包一个可独立运行的跨平台 App 给别人使用：

```bash
pnpm tauri build
```
编译产物将会生成在 `src-tauri/target/release/bundle` 目录下（如 macOS 的 `.app` / `.dmg`，Windows 的 `.exe` 等）。

---

## 🎮 使用指南 (How to use)

1. **拖拽角色**：将鼠标光标移动到小人身上，按住左键即可随意在屏幕内拖拽。
2. **呼出/隐藏终端**：小人旁边会跟随一个终端面板，点击外部空白区域可自动收起。
3. **切换角色与主题**：在右侧终端面板的顶部，有两个下拉菜单，分别用于切换“角色”和“终端主题”。
4. **清屏指令**：在终端输入框内输入 `/clear` 并回车，即可快速清空当前屏幕的对话记录。
5. **退出应用**：你可以点击屏幕右上角系统托盘（状态栏）的 CodeWalkers 图标，然后选择 `Quit` 完全退出程序。

---

## 📂 项目结构 (Structure)

- `src/` - React 前端代码 (UI, IPC 交互, 拖拽逻辑, 动画渲染, 主题系统)
- `src-tauri/` - Rust 后端代码 (窗口管理, PTY 终端进程挂载, 透明度控制, 系统托盘)
- `public/` - 静态资源 (视频动画 `walk-bruce-01.mov`, 音效文件 `sounds/`)
- `.github/workflows/` - CI/CD 自动化工作流程

---

## 📄 开源协议 (License)

本项目采用 [MIT License](./LICENSE) 开源协议。欢迎自由使用、修改和分发。
