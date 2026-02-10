export interface User {
  id: string;
  name: string;
  avatar: string;
  region?: string;
  signature?: string;
}

export interface Message {
  id: string;
  senderId: string; // 'me' or other userId
  type: 'text' | 'image';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  userId: string; // The person/group being chatted with
  messages: Message[];
  unreadCount: number;
  isGroup?: boolean;
}

export interface AppState {
  user: User; // Current logged in user
  contacts: User[];
  sessions: ChatSession[];
}

export type Tab = 'chat' | 'contact' | 'profile';