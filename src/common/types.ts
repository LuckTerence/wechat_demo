export interface User {
  id: string;
  name: string;
  avatar: string;
  region?: string;
  signature?: string;
  level?: number;
}

export interface Message {
  id: string;
  senderId: string;
  type: "text" | "image";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: Message[];
  unreadCount: number;
  isGroup?: boolean;
  groupMemberIds?: string[];
}

export type Tab = "chat" | "contact" | "profile";
