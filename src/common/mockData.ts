import type { ChatSession, Message, User } from "./types";
import { MOCK_MY_USER_ID } from "./constants";

const AVATAR_BASE = "https://api.dicebear.com/7.x/avataaars/svg?seed=";
const IMAGE_BASE = "https://picsum.photos/seed";

const baseNames = [
  "File Transfer Assistant",
  "Product R&D Group",
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eva",
  "Frank",
  "Grace",
  "Helen",
  "Ivy",
  "Jason",
  "Kathy",
  "Leo",
  "Mia",
  "Nina",
  "Oscar",
  "Peter",
  "Queenie",
  "Ryan",
  "Sophia",
  "Tom",
  "Uma",
  "Victor",
];

const sampleReplies = [
  "Morning, any update from your side?",
  "Let's sync after lunch.",
  "Looks good to me.",
  "I will send the draft in 10 minutes.",
  "Can we move this to tomorrow?",
  "Great, thanks for the quick response.",
  "Noted. I will follow this up.",
];

const sampleMine = [
  "Sure, give me a second.",
  "I just pushed a new version.",
  "Got it, checking now.",
  "No problem, let's do it.",
  "I can handle this one.",
  "Let's keep it simple first.",
];

const cloneMessage = (message: Message): Message => ({
  ...message,
});

const cloneSession = (session: ChatSession): ChatSession => ({
  ...session,
  messages: session.messages.map(cloneMessage),
});

const avatarByName = (name: string) => {
  if (name === "File Transfer Assistant") {
    return "https://cdn-icons-png.flaticon.com/512/3767/3767084.png";
  }
  if (name === "Product R&D Group") {
    return "https://cdn-icons-png.flaticon.com/512/1256/1256650.png";
  }
  return `${AVATAR_BASE}${encodeURIComponent(name)}`;
};

const userIdByIndex = (index: number) => {
  if (index === 0) {
    return "file-helper";
  }
  if (index === 1) {
    return "group-rd";
  }
  return `user-${index}`;
};

const randomBy = (seed: number) => {
  const x = Math.sin(seed * 9.73) * 10000;
  return x - Math.floor(x);
};

const buildMessages = (contact: User, index: number): Message[] => {
  const now = Date.now();
  const seedA = Math.floor(randomBy(index + 3) * sampleReplies.length);
  const seedB = Math.floor(randomBy(index + 11) * sampleMine.length);
  const baseTime = now - index * 1000 * 60 * 35;
  const shouldImage = index % 4 === 0;

  const result: Message[] = [
    {
      id: `msg-${contact.id}-a`,
      senderId: contact.id,
      type: "text",
      content: sampleReplies[seedA],
      timestamp: baseTime - 1000 * 60 * 2,
    },
    {
      id: `msg-${contact.id}-b`,
      senderId: MOCK_MY_USER_ID,
      type: "text",
      content: sampleMine[seedB],
      timestamp: baseTime - 1000 * 40,
    },
  ];

  if (shouldImage) {
    result.push({
      id: `msg-${contact.id}-c`,
      senderId: contact.id,
      type: "image",
      content: `${IMAGE_BASE}/${encodeURIComponent(contact.id)}-chat/640/420`,
      timestamp: baseTime,
    });
  } else {
    const tailSeed = Math.floor(randomBy(index + 29) * sampleReplies.length);
    result.push({
      id: `msg-${contact.id}-c`,
      senderId: contact.id,
      type: "text",
      content: sampleReplies[tailSeed],
      timestamp: baseTime,
    });
  }

  return result;
};

export const currentUser: User = {
  id: MOCK_MY_USER_ID,
  name: "Terence",
  avatar: `${AVATAR_BASE}Terence`,
  region: "Shenzhen, China",
  signature: "Keep it simple, keep it fast.",
  level: 9,
};

export const generateContacts = (count = 18): User[] => {
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    names.push(baseNames[i] || `Friend ${i + 1}`);
  }

  return names.map((name, index) => ({
    id: userIdByIndex(index),
    name,
    avatar: avatarByName(name),
    region: index % 2 === 0 ? "Beijing" : "Shanghai",
    signature: `Status of ${name}...`,
    level: 1 + (index % 10),
  }));
};

export const generateSessionPool = (contacts: User[]): ChatSession[] => {
  const unreadPattern = [0, 1, 0, 2, 0, 0, 3, 0, 1, 0, 0, 2];
  const defaultGroupMembers = contacts
    .filter((contact) => contact.id !== "file-helper" && contact.id !== "group-rd")
    .slice(0, 4)
    .map((contact) => contact.id);
  const sessions = contacts.map((contact, index) => {
    const unreadCount = contact.id === "file-helper" ? 0 : unreadPattern[index % unreadPattern.length];
    const isGroup = contact.id === "group-rd";

    return {
      id: contact.id,
      userId: contact.id,
      unreadCount,
      isGroup,
      groupMemberIds: isGroup ? defaultGroupMembers : undefined,
      messages: buildMessages(contact, index),
    };
  });

  return sessions.sort((a, b) => {
    const timeA = a.messages[a.messages.length - 1]?.timestamp || 0;
    const timeB = b.messages[b.messages.length - 1]?.timestamp || 0;
    return timeB - timeA;
  });
};

export const cloneSessions = (sessions: ChatSession[]): ChatSession[] => {
  return sessions.map(cloneSession);
};
