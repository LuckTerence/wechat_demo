import { NextResponse } from "next/server";
import { generateAIReply } from "@/lib/gemini";
import type { Message } from "@/types";

export const runtime = "nodejs";

interface AIReplyBody {
  messages?: unknown;
  contactName?: unknown;
}

const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<Message>;

  return (
    typeof message.id === "string" &&
    typeof message.senderId === "string" &&
    (message.type === "text" || message.type === "image") &&
    typeof message.content === "string" &&
    typeof message.timestamp === "number"
  );
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AIReplyBody;

    if (!Array.isArray(body.messages) || !body.messages.every(isMessage)) {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }

    if (typeof body.contactName !== "string" || body.contactName.trim().length === 0) {
      return NextResponse.json({ error: "contactName is required." }, { status: 400 });
    }

    const reply = await generateAIReply(body.messages, body.contactName.trim());
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json({ error: "Failed to generate AI reply." }, { status: 500 });
  }
}
