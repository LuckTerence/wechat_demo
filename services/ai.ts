import { GoogleGenAI } from "@google/genai";
import { Message } from '../types';

// Initialize AI with the API Key from environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getAIReply = async (messages: Message[], contactName: string): Promise<string> => {
  try {
    // Filter text messages for context, simple logic for demo
    const lastUserMessage = [...messages].reverse().find(m => m.senderId === 'me' && m.type === 'text');
    
    if (!lastUserMessage) return "Hello!";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: lastUserMessage.content,
      config: {
        systemInstruction: `You are ${contactName}, a user in a chat application like WeChat. 
        Your replies should be:
        1. Casual and natural (like a real friend).
        2. Concise (usually 1-2 sentences).
        3. Relevant to the previous message.
        4. Do not act like an AI assistant, act like a human friend.`,
      }
    });

    return response.text || "Thumbs up!";
  } catch (error) {
    console.error("AI Error:", error);
    return "I'm a bit busy right now, talk later!";
  }
};