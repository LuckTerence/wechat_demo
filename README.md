# WeChat Demo (Next.js Fullstack)

This project is now a Next.js fullstack app:
- Frontend: React UI rendered by Next.js
- Backend: Next.js API route (`/api/ai-reply`) calls OpenAI-compatible APIs or Gemini
- Security: server-side keys are read only on the server and never sent to the browser

## 1. Install

```bash
npm install
```

## 2. Configure server env

Create `.env.local` from `.env.example`.

Use OpenAI-compatible (official OpenAI or third-party compatible endpoints):

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_real_key
```

Or use Gemini:

```bash
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.0-flash
```

Provider order:
- If `OPENAI_API_KEY` is set, backend tries OpenAI-compatible first.
- If OpenAI-compatible fails and `GEMINI_API_KEY` is set, backend falls back to Gemini.

## 3. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Security notes

- Do not put server keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) in `NEXT_PUBLIC_*` variables.
- Do not call AI providers directly from client components.
- Keep AI calls inside server files (`app/api/**`, `lib/gemini.ts`).
