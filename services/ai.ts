import type { Message } from "../types";

const FALLBACK_REPLY = "I'm a bit busy right now, talk later!";

export const getAIReply = async (
  messages: Message[],
  contactName: string,
): Promise<string> => {
  try {
    const response = await fetch("/api/ai-reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ messages, contactName }),
    });

    if (!response.ok) {
      console.error("AI API request failed:", response.status, response.statusText);
      return FALLBACK_REPLY;
    }

    const payload = (await response.json()) as { reply?: string };

    if (typeof payload.reply === "string" && payload.reply.trim().length > 0) {
      return payload.reply;
    }

    return FALLBACK_REPLY;
  } catch (error) {
    console.error("AI Error:", error);
    return FALLBACK_REPLY;
  }
};
