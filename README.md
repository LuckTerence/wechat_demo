# 微信聊天 Demo（uni-app / Vue3）

这是一个微信风格的聊天演示项目，已从 Next.js/React 迁移到 **uni-app（Vue3 + Vite）**。

## 功能说明

- 聊天列表、联系人、个人中心三栏
- 聊天详情页（文本消息、图片消息）
- AI 自动回复（通过服务端代理接口）
- 移动端友好的页面布局

## 技术栈

- uni-app
- Vue 3
- TypeScript
- Vite

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动本地后端 API（必须）

后端读取 `.env.local` 或 `.env.api.local` 中的服务端密钥：

```bash
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-max
OPENAI_API_KEY=your_server_only_key
PORT=8787
```

启动后端：

```bash
npm run dev:api
```

### 3. 配置前端环境变量

复制 `.env.example` 为 `.env.local`，配置 AI 代理接口地址：

```bash
VITE_AI_REPLY_URL=http://127.0.0.1:8787/api/ai-reply
```

说明：
- 该项目是前端应用，建议调用你自己的服务端代理接口。
- 不要把 OpenAI/通义/Gemini 的真实密钥放到 `VITE_*` 变量中。

### 4. 本地运行（H5）

```bash
npm run dev:h5
```

### 5. 构建（H5）

```bash
npm run build:h5
```

可选：清理缓存后重编译

```bash
npm run clean
```

## 目录结构（核心）

- `src/pages/index/index.vue`: 主页面（聊天、联系人、个人中心）
- `src/common/mockData.ts`: 模拟联系人与会话数据
- `src/common/ai.ts`: AI 回复请求封装
- `src/pages.json`: uni-app 页面路由配置
- `src/manifest.json`: uni-app 应用配置

## 安全建议

- API key 只放在服务端，不放在前端仓库
- `.env.local` 不要提交到 GitHub
- 线上请使用服务端转发 AI 请求，避免密钥泄露
