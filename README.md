# 微信聊天 Demo（Next.js 全栈）

一个微信风格的聊天演示项目，前端使用 Next.js + React 构建界面，后端通过 `/api/ai-reply` 调用大模型生成自动回复。

## 项目特点

- 微信风格聊天 UI，支持消息发送、会话切换、移动端访问
- 服务端统一代理 AI 请求，避免在浏览器暴露密钥
- 支持 OpenAI 兼容接口（含第三方平台）和 Gemini
- 部署到 Vercel 即可直接运行

## 技术栈

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，然后按你使用的平台填写。

推荐：通义千问（DashScope OpenAI 兼容接口）

```bash
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-max
OPENAI_API_KEY=your_dashscope_key
```

可选：OpenAI 官方

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_key
```

可选：Gemini（作为备用）

```bash
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash
```

Provider 顺序：

- 配置了 `OPENAI_API_KEY` 时，优先走 OpenAI 兼容接口
- OpenAI 兼容请求失败且配置了 `GEMINI_API_KEY` 时，会回退到 Gemini

### 3. 启动项目

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 部署说明（Vercel）

在 Vercel 项目里配置与本地一致的环境变量后重新部署：

- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_API_KEY`
- （可选）`GEMINI_API_KEY`
- （可选）`GEMINI_MODEL`

## 安全说明

- 不要把服务端密钥放到 `NEXT_PUBLIC_*` 变量里
- 不要在前端组件里直接请求 AI 平台
- 所有 AI 调用都放在服务端文件（`app/api/**`, `lib/gemini.ts`）
