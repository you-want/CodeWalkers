# CodeWalkers 完整使用手册

CodeWalkers 是一个在你的 macOS 桌面和程序坞上方陪伴你的 AI 虚拟助手。你可以和这些虚拟小人对话，它们会思考、漫步，并在你需要时提供强大的 AI 命令行能力（支持 Claude, Gemini, Copilot 等）。

## 🛠 一、 安装与配置 AI 模型 (以 Gemini 为例)

由于应用完全在你的本地运行，它需要调用各大 AI 平台的 CLI（命令行工具）来工作。

### 1. 申请你的 API Key
在使用之前，你需要获取一把“钥匙”来解锁 AI 的能力。
* 访问 [Google AI Studio](https://aistudio.google.com/app/apikey) 
* 登录你的 Google 账号，点击 **"Create API key"**。
* 复制生成的那一长串字符（比如 `AIzaSy...`）。

### 2. 配置到本地
拿到 Key 后，你需要告诉本地的 Gemini 命令行工具：
1. 打开你 Mac 上的 **终端 (Terminal)** 应用程序。
2. 复制并运行下面这行命令（请将 `你的_API_KEY_放在这里` 替换为你刚刚复制的真实 Key）：
```bash
echo '{"auth": "API_KEY", "apiKey": "你的_API_KEY_放在这里"}' > ~/.gemini/settings.json
```
*(注意：保留命令里的双引号，只替换文字部分。)*

### 3. 配置网络代理 (重要：国内用户必看)
由于国内网络限制，在连接 Google (Gemini) 或 Claude 的服务器时，通常需要配置网络代理，否则会出现 `fetch failed sending request` 或持续 `Retrying with backoff...` 的错误。

**解决方案：**
在启动 CodeWalkers **之前**，请先在终端（Terminal）中执行以下命令，让当前终端环境走代理（这里以本地 `7897` 端口为例，请根据你的实际代理软件端口调整）：
```bash
export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897
```
*(注意：执行完这行命令后，它没有任何提示是正常的。接下来在**同一个**终端窗口里执行 `pnpm tauri dev` 启动项目，即可让 AI 顺畅联网！)*

---

## 🚀 二、 启动与使用 CodeWalkers

### 1. 启动项目
如果你是在开发环境下：
```bash
pnpm tauri dev
```
启动后，你会看到一个小人（Ethan 或 Luna）出现在你的屏幕上。

### 2. 界面交互指南

#### 🎮 小人与面板控制
* **拖拽小人**：你可以用鼠标点击并按住小人，把它拖拽到屏幕的任何位置（比如坐在你浏览器的边缘）。
* **拖拽面板**：点击按住右侧控制面板顶部写着 **"Terminal"** 的标题区域，可以自由拖拽面板。
* **角色切换**：面板顶部的第一个下拉框可以让你在不同的角色（如 Ethan 或 Luna）之间切换。
* **主题切换**：第二个下拉框可以切换面板的视觉主题（Playful / Hacker / Monochrome）。

#### 🤖 连接 AI 助手
1. 在面板的中间部分，你会看到各种 AI 供应商的按钮。
2. 如果显示 **"Gemini (Click to Install)"**：
   * 点击它，系统会自动弹出一个 Mac 终端窗口。
   * 在终端里，如果提示输入 Password，请输入你的 Mac 开机密码并回车。
   * 安装完成后，面板会自动检测到并更新。
3. 当显示为 **"Start Gemini"** 时，点击它。
   * 面板会提示 `Started session with /usr/local/bin/gemini`。
   * 这时说明 AI 助手已经准备就绪！

#### 💬 开始对话
1. 面板底部会出现一个聊天输入框。
2. 在里面输入你的问题（例如："用 Python 写一个计算斐波那契数列的函数"）。
3. 按下 `Enter` 键或点击 **Send** 发送。
4. 此时，桌面的小人头上会冒出一个思考的气泡，并伴随提示音。
5. AI 的回复会逐行打印在面板的 Terminal 黑色输出框中！

### 3. 常见问题排查 (FAQ)

**Q: 点击 Start Gemini 后，报错 `[Err]: Please set an Auth method... Broken pipe (os error 32)`**
**A**: 这是因为你还没有配置 API Key，或者配置格式不对。请严格按照本文档 **第一步** 的命令，将你的 API Key 写入 `~/.gemini/settings.json` 文件中。配置好后，重启一下 CodeWalkers 即可。

**Q: 点击安装没有反应，或者报错？**
**A**: 我们已经优化了安装流程。点击安装时会自动弹出一个外部原生终端（Terminal）。如果你的网络环境需要科学上网才能访问 Google (Gemini) 或 Claude，请确保你的终端已经配置了代理。

**Q: 怎么清空当前的聊天记录？**
**A**: 在输入框中输入 `/clear` 并发送，即可清空当前面板的输出记录。

---
*享受你的桌面 AI 伙伴吧！*