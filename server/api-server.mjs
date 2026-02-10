import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_REPLY = "LetWechat is a little busy now, please try again in a moment.";
const EMPTY_CONTEXT_REPLY = "Hello!";

const envFiles = [".env", ".env.local", ".env.api.local"];
for (const file of envFiles) {
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full, override: true });
  }
}

const normalizeBaseUrl = (value) => value.replace(/\/+$/, "");
const resolveBaseUrl = () => {
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.trim()) {
    return normalizeBaseUrl(process.env.OPENAI_BASE_URL.trim());
  }
  return "https://dashscope.aliyuncs.com/compatible-mode/v1";
};

const resolveModel = () => {
  if (process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim()) {
    return process.env.OPENAI_MODEL.trim();
  }
  return "qwen-plus";
};

const resolveFallbackModel = () => {
  if (process.env.OPENAI_FALLBACK_MODEL && process.env.OPENAI_FALLBACK_MODEL.trim()) {
    return process.env.OPENAI_FALLBACK_MODEL.trim();
  }
  return "qwen-plus";
};

const extractReplyText = (payload) => {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => (part && typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    return joined;
  }
  return "";
};

const getLastUserText = (messages) => {
  if (!Array.isArray(messages)) {
    return "";
  }
  const found = [...messages]
    .reverse()
    .find((item) => item?.senderId === "me" && item?.type === "text" && typeof item?.content === "string");
  return found?.content?.trim() || "";
};

const buildSystemInstruction = (contactName) => {
  return `You are ${contactName}, a user in a chat application called LetWechat.
Your replies should be:
1. Casual and natural (like a real friend).
2. Concise (usually 1-2 sentences).
3. Relevant to the previous message.
4. Do not act like an AI assistant, act like a human friend.`;
};

const extractProviderErrorMessage = (bodyText) => {
  if (!bodyText || typeof bodyText !== "string") {
    return "";
  }

  try {
    const payload = JSON.parse(bodyText);
    const directMessage = payload?.message;
    if (typeof directMessage === "string" && directMessage.trim()) {
      return directMessage.trim();
    }

    const nestedErrorMessage = payload?.error?.message;
    if (typeof nestedErrorMessage === "string" && nestedErrorMessage.trim()) {
      return nestedErrorMessage.trim();
    }
  } catch {
    // ignore JSON parse errors and fallback to raw text
  }

  return bodyText.trim().slice(0, 240);
};

const requestCompletion = ({ endpoint, apiKey, model, contactName, lastUserText }) => {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemInstruction(contactName.trim()) },
        { role: "user", content: lastUserText },
      ],
      temperature: 0.8,
    }),
  });
};

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/ai-reply", async (req, res) => {
  try {
    const { messages, contactName } = req.body || {};
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid messages payload." });
      return;
    }
    if (typeof contactName !== "string" || contactName.trim().length === 0) {
      res.status(400).json({ error: "contactName is required." });
      return;
    }

    const lastUserText = getLastUserText(messages);
    if (!lastUserText) {
      res.json({ reply: EMPTY_CONTEXT_REPLY });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Missing OPENAI_API_KEY in server env." });
      return;
    }

    const baseUrl = resolveBaseUrl();
    const primaryModel = resolveModel();
    const fallbackModel = resolveFallbackModel();
    const endpoint = `${baseUrl}/chat/completions`;
    const modelQueue =
      fallbackModel && fallbackModel !== primaryModel
        ? [primaryModel, fallbackModel]
        : [primaryModel];

    let lastFailure = null;

    for (const model of modelQueue) {
      const response = await requestCompletion({
        endpoint,
        apiKey,
        model,
        contactName,
        lastUserText,
      });

      if (response.ok) {
        const payload = await response.json();
        const reply = extractReplyText(payload);
        res.json({ reply: reply || DEFAULT_REPLY, model });
        return;
      }

      const bodyText = await response.text();
      const providerMessage = extractProviderErrorMessage(bodyText);
      const isAuthError = response.status === 401;

      if (isAuthError) {
        const message = "AI provider authentication failed.";
        res.status(401).json({
          error: message,
          message,
          detail: providerMessage
            ? `providerStatus=${response.status}, model=${model}, providerMessage=${providerMessage}`
            : `providerStatus=${response.status}, model=${model}, baseUrl=${baseUrl}`,
        });
        return;
      }

      lastFailure = {
        status: response.status,
        model,
        providerMessage,
      };
    }

    res.status(502).json({
      error: "AI provider request failed.",
      detail: lastFailure?.providerMessage
        ? `providerStatus=${lastFailure.status}, model=${lastFailure.model}, providerMessage=${lastFailure.providerMessage}`
        : `baseUrl=${baseUrl}, triedModels=${modelQueue.join(",")}`,
    });
  } catch (error) {
    console.error("API route error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Internal server error.", detail });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, "0.0.0.0", () => {
  console.log(`[api] listening on http://127.0.0.1:${port}`);
});
