import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { Message } from "@/types";

const DEFAULT_REPLY = "I'm a bit busy right now, talk later!";
const EMPTY_CONTEXT_REPLY = "Hello!";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

type Provider = "openai" | "gemini";

interface OpenAIChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Set it in your server environment.");
  }

  return new GoogleGenAI({ apiKey });
};

const buildSystemInstruction = (contactName: string) => {
  return `You are ${contactName}, a user in a chat application like WeChat.
Your replies should be:
1. Casual and natural (like a real friend).
2. Concise (usually 1-2 sentences).
3. Relevant to the previous message.
4. Do not act like an AI assistant, act like a human friend.`;
};

const getLastUserText = (messages: Message[]) => {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.senderId === "me" && message.type === "text");

  return lastUserMessage?.content.trim() || "";
};

const getProviderOrder = (): Provider[] => {
  const providers: Provider[] = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push("openai");
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push("gemini");
  }

  return providers;
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");
const isLikelyDashScopeKey = (apiKey: string) => /^sk-[a-f0-9]{32}$/i.test(apiKey.trim());
const isLikelyDashScopeModel = (model: string) => /^(qwen|qwq|tongyi|kimi|glm)/i.test(model.trim());
const isOpenAIOfficialBaseUrl = (baseUrl: string) => /^https:\/\/api\.openai\.com\/v1$/i.test(baseUrl);

const resolveOpenAIBaseUrl = (apiKey: string, model: string): string => {
  const configured = process.env.OPENAI_BASE_URL?.trim();
  const useDashScope = isLikelyDashScopeKey(apiKey) || isLikelyDashScopeModel(model);

  if (configured) {
    const normalized = normalizeBaseUrl(configured);
    if (useDashScope && isOpenAIOfficialBaseUrl(normalized)) {
      return DEFAULT_DASHSCOPE_BASE_URL;
    }

    return normalized;
  }

  if (useDashScope) {
    return DEFAULT_DASHSCOPE_BASE_URL;
  }

  return DEFAULT_OPENAI_BASE_URL;
};

const resolveOpenAIModel = (apiKey: string): string => {
  const configured = process.env.OPENAI_MODEL?.trim();
  if (configured) {
    return configured;
  }

  if (isLikelyDashScopeKey(apiKey)) {
    return "qwen3-max";
  }

  return DEFAULT_OPENAI_MODEL;
};

const extractOpenAIText = (content: unknown): string => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const text = content
    .filter((part): part is { type?: unknown; text?: unknown } => typeof part === "object" && part !== null)
    .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  return text;
};

const generateOpenAICompatibleReply = async (
  lastUserText: string,
  contactName: string,
): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const model = resolveOpenAIModel(apiKey);
  const baseUrl = resolveOpenAIBaseUrl(apiKey, model);
  const endpoint = `${baseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemInstruction(contactName) },
        { role: "user", content: lastUserText },
      ],
      temperature: 0.8,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenAI-compatible request failed (${response.status} ${response.statusText}, baseUrl=${baseUrl}): ${body.slice(0, 400)}`,
    );
  }

  const payload = (await response.json()) as OpenAIChatCompletionsResponse;
  const text = extractOpenAIText(payload.choices?.[0]?.message?.content);

  if (!text) {
    throw new Error("OpenAI-compatible response did not include text content.");
  }

  return text;
};

const generateGeminiReply = async (lastUserText: string, contactName: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: lastUserText,
    config: {
      systemInstruction: buildSystemInstruction(contactName),
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Gemini response did not include text content.");
  }

  return text;
};

export const generateAIReply = async (
  messages: Message[],
  contactName: string,
): Promise<string> => {
  const lastUserText = getLastUserText(messages);
  if (!lastUserText) {
    return EMPTY_CONTEXT_REPLY;
  }

  const providers = getProviderOrder();
  if (providers.length === 0) {
    console.error("AI config missing. Set OPENAI_API_KEY or GEMINI_API_KEY.");
    return DEFAULT_REPLY;
  }
  
  for (const provider of providers) {
    try {
      if (provider === "openai") {
        return await generateOpenAICompatibleReply(lastUserText, contactName);
      }

      return await generateGeminiReply(lastUserText, contactName);
    } catch (error) {
      console.error(`${provider} server call failed:`, error);
    }
  }

  return DEFAULT_REPLY;
};
