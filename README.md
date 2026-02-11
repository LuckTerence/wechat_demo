# LetWechat Demo

A mobile-first chat demo built with `uni-app + Vue 3 + TypeScript`.

## What this project includes
- Chat list, contacts, and profile tabs
- Chat detail page (text/image messages)
- AI reply via backend proxy API
- Mock data for users, sessions, and messages

## Tech stack
- `uni-app`
- `Vue 3`
- `TypeScript`
- `Vite`
- Local API server: `Express`

## Project structure
- `src/pages/index/index.vue`: main UI page
- `src/common/mockData.ts`: mock users/sessions/messages
- `src/common/ai.ts`: frontend AI request wrapper
- `server/api-server.mjs`: local backend API (`/api/ai-reply`)
- `api/ai-reply.js`: Vercel serverless API entry

## Quick start
1. Install dependencies
```bash
npm install
```

2. Configure `.env.local`
```dotenv
VITE_AI_REPLY_URL=http://127.0.0.1:8787/api/ai-reply
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-plus
OPENAI_API_KEY=your_server_only_key
PORT=8787
```

3. Start backend API
```bash
npm run dev:api
```

4. Start H5 frontend
```bash
npm run dev:h5
```

## Build
```bash
npm run build:h5
```

## Security
- Do not put real provider keys in `VITE_*` variables
- Do not commit `.env.local`
