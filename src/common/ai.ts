import type { Message } from "./types";

const FALLBACK_REPLY = "LetWechat is a little busy now, please try again in a moment.";
const DEFAULT_ENDPOINT = "/api/ai-reply";
const REQUEST_CACHE_TTL_MS = 15000;
const REQUEST_CACHE_LIMIT = 120;
let resolvedEndpointCache: string | null = null;
const replyCache = new Map<string, { reply: string; expiresAt: number }>();
const inFlightReplyMap = new Map<string, Promise<string>>();

const getLastUserText = (messages: Message[]) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item.senderId === "me" && item.type === "text") {
      return item.content.trim();
    }
  }
  return "";
};

const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const buildRequestKey = (messages: Message[], contactName: string) => {
  const lastUserText = getLastUserText(messages);
  return `${normalizeKey(contactName)}|${normalizeKey(lastUserText)}`;
};

const getCachedReply = (key: string) => {
  const cached = replyCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    replyCache.delete(key);
    return null;
  }
  return cached.reply;
};

const setCachedReply = (key: string, reply: string) => {
  if (!reply || reply === FALLBACK_REPLY) {
    return;
  }
  if (replyCache.size >= REQUEST_CACHE_LIMIT) {
    const firstKey = replyCache.keys().next().value;
    if (firstKey) {
      replyCache.delete(firstKey);
    }
  }
  replyCache.set(key, {
    reply,
    expiresAt: Date.now() + REQUEST_CACHE_TTL_MS,
  });
};

const resolveEndpoint = () => {
  if (resolvedEndpointCache) {
    return resolvedEndpointCache;
  }

  const custom = import.meta.env.VITE_AI_REPLY_URL;
  if (custom && custom.trim().length > 0) {
    const endpoint = custom.trim();
    if (typeof window !== "undefined") {
      try {
        const parsed = new URL(endpoint, window.location.origin);
        const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
        const currentHost = window.location.hostname;
        const currentIsLocal = currentHost === "127.0.0.1" || currentHost === "localhost";

        // When testing from a phone browser, localhost points to the phone itself.
        if (isLocalHost && !currentIsLocal) {
          parsed.hostname = currentHost;
          resolvedEndpointCache = parsed.toString();
          return resolvedEndpointCache;
        }
        resolvedEndpointCache = parsed.toString();
        return resolvedEndpointCache;
      } catch {
        resolvedEndpointCache = endpoint;
        return endpoint;
      }
    }
    resolvedEndpointCache = endpoint;
    return endpoint;
  }
  resolvedEndpointCache = DEFAULT_ENDPOINT;
  return resolvedEndpointCache;
};

const parseErrorMessage = (raw: unknown): string => {
  if (typeof raw === "string") {
    return raw.trim() || "Unknown error";
  }
  if (!raw || typeof raw !== "object") {
    return "Unknown error";
  }

  const payload = raw as Record<string, unknown>;
  const directMessage = payload.message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage.trim();
  }

  const directError = payload.error;
  if (typeof directError === "string" && directError.trim()) {
    return directError.trim();
  }

  if (directError && typeof directError === "object") {
    const nestedError = directError as Record<string, unknown>;
    if (typeof nestedError.message === "string" && nestedError.message.trim()) {
      return nestedError.message.trim();
    }
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }

  return "Unknown error";
};

const toFriendlyReply = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("invalid api key") ||
    normalized.includes("authentication failed")
  ) {
    return "AI authentication failed. Check OPENAI_BASE_URL, OPENAI_MODEL and OPENAI_API_KEY on server.";
  }

  if (normalized.includes("missing openai_api_key")) {
    return "Server env is incomplete. Add OPENAI_API_KEY before starting API server.";
  }

  if (normalized.includes("404")) {
    return "AI endpoint not found. Check VITE_AI_REPLY_URL and make sure it points to /api/ai-reply.";
  }

  if (normalized.includes("status 5")) {
    return "AI provider returned an internal error. Please retry later or switch model/base URL.";
  }

  if (normalized.includes("timeout") || normalized.includes("network") || normalized.includes("connect")) {
    return "Cannot reach AI service now. Ensure backend API server is running and reachable.";
  }

  return FALLBACK_REPLY;
};

const requestJSON = <T>(options: UniApp.RequestOptions) =>
  new Promise<T>((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
          return;
        }
        const message = parseErrorMessage(res.data);
        reject(new Error(`Request failed with status ${res.statusCode}: ${message}`));
      },
      fail: (err) => reject(err),
    });
  });

export const getAIReply = async (messages: Message[], contactName: string): Promise<string> => {
  const requestKey = buildRequestKey(messages, contactName);
  const cachedReply = getCachedReply(requestKey);
  if (cachedReply) {
    return cachedReply;
  }

  const pending = inFlightReplyMap.get(requestKey);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    try {
      const endpoint = resolveEndpoint();
      const payload = await requestJSON<{ reply?: string }>({
        url: endpoint,
        method: "POST",
        data: {
          messages,
          contactName,
        },
        header: {
          "Content-Type": "application/json",
        },
        timeout: 20000,
      });

      if (typeof payload.reply === "string" && payload.reply.trim().length > 0) {
        const reply = payload.reply.trim();
        setCachedReply(requestKey, reply);
        return reply;
      }

      return FALLBACK_REPLY;
    } catch (error) {
      console.error("AI Error:", error);
      return toFriendlyReply(error);
    }
  })();

  inFlightReplyMap.set(requestKey, task);

  try {
    return await task;
  } finally {
    inFlightReplyMap.delete(requestKey);
  }
};
