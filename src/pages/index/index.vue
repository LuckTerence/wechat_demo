<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { getAIReply } from "../../common/ai";
import { MOCK_MY_USER_ID } from "../../common/constants";
import { cloneSessions, currentUser, generateContacts, generateSessionPool } from "../../common/mockData";
import type { ChatSession, Message, Tab, User } from "../../common/types";

type SubPageType = "settings" | "general";
type MessageType = "text" | "image";

const contacts = ref<User[]>(generateContacts());
const initialPageSize = 8;
const loadMoreSize = 6;
const sessionPool = ref<ChatSession[]>(generateSessionPool(contacts.value));
const sessionCursor = ref(Math.min(initialPageSize, sessionPool.value.length));
const sessions = ref<ChatSession[]>(cloneSessions(sessionPool.value.slice(0, sessionCursor.value)));
const currentTab = ref<Tab>("chat");
const activeSessionId = ref<string | null>(null);
const viewingContactId = ref<string | null>(null);
const subPage = ref<SubPageType | null>(null);
const inputValue = ref("");
const messageScrollIntoView = ref("");
const chatListScrollIntoView = ref("");
const chatListScrollTop = ref(0);
const chatListSavedScrollTop = ref(0);
const chatListLastScrollTop = ref(0);
const lastChatTabTapAt = ref(0);
const chatListRefreshing = ref(false);
const chatListRefresherTriggered = ref(false);
const chatListLoadingMore = ref(false);
const chatListLoadMoreArmed = ref(true);
const chatListLoadingText = ref("Pull up to load more");
const chatListLastLoadMoreAt = ref(0);
const searchOpen = ref(false);
const searchKeyword = ref("");
const debouncedSearchKeyword = ref("");
const animatingMessageIds = ref<Set<string>>(new Set());
const moreMenuOpen = ref(false);
const createdGroupCount = ref(1);
const groupCreateMode = ref(false);
const selectedGroupMemberIds = ref<string[]>([]);
const emojiPanelOpen = ref(false);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const emojiOptions = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😎",
  "🤔",
  "😭",
  "😡",
  "👍",
  "🙏",
  "👏",
  "🎉",
  "🔥",
  "🌟",
  "❤️",
  "💯",
  "✅",
];

const profileMenus: Array<{ label: string; key: SubPageType }> = [
  { label: "Settings", key: "settings" },
  { label: "General", key: "general" },
];

const groupFallbackReplies = [
  "I can take this and share an update soon.",
  "Noted. I will verify and sync back shortly.",
  "Thanks. I will continue from this point.",
  "Understood. I will check details right away.",
  "Good call. I will prepare the next update.",
];

const groupReplyPrefixes = ["Quick note:", "From my side,", "Update:", "I checked this,", "One more point:"];
const groupReplySuffixes = [
  "I will keep this thread updated.",
  "Let's move this forward.",
  "I am handling this now.",
  "I will share results soon.",
  "We can continue with this plan.",
];

const sortedSessions = computed(() => {
  return [...sessions.value].sort((a, b) => {
    const timeA = a.messages[a.messages.length - 1]?.timestamp || 0;
    const timeB = b.messages[b.messages.length - 1]?.timestamp || 0;
    return timeB - timeA;
  });
});

const contactsById = computed(() => {
  const map = new Map<string, User>();
  for (const contact of contacts.value) {
    map.set(contact.id, contact);
  }
  map.set(currentUser.id, currentUser);
  return map;
});

const activeSession = computed<ChatSession | null>(() => {
  if (!activeSessionId.value) {
    return null;
  }
  return sessions.value.find((item) => item.id === activeSessionId.value) || null;
});

const activeContact = computed<User | null>(() => {
  if (!activeSession.value) {
    return null;
  }
  return contactsById.value.get(activeSession.value.userId) || null;
});

const viewingContact = computed<User | null>(() => {
  if (!viewingContactId.value) {
    return null;
  }
  return contactsById.value.get(viewingContactId.value) || null;
});

const totalUnread = computed(() => {
  return sessions.value.reduce((count, session) => count + session.unreadCount, 0);
});

const chatListHasMore = computed(() => {
  return sessionCursor.value < sessionPool.value.length;
});

const subPageTitle = computed(() => (subPage.value === "settings" ? "Settings" : "General"));

const subPageItems = computed(() => {
  if (subPage.value === "settings") {
    return ["Notifications", "Privacy", "Security", "Help & Feedback", "About"];
  }
  return ["Language", "Storage", "Appearance", "Photos, Videos, Files", "Accessibility"];
});

const hasInputText = computed(() => inputValue.value.trim().length > 0);
const tabOrder: Tab[] = ["chat", "contact", "profile"];
const tabTransitionName = ref("tab-slide-left");

const tabIndexOf = (tab: Tab) => {
  const index = tabOrder.indexOf(tab);
  return index < 0 ? 0 : index;
};

const tabActivePillStyle = computed(() => {
  return {
    transform: `translateX(calc(${tabIndexOf(currentTab.value)} * 100%))`,
  };
});

const switchTabWithSlide = (nextTab: Tab) => {
  const currentIndex = tabIndexOf(currentTab.value);
  const nextIndex = tabIndexOf(nextTab);
  tabTransitionName.value = nextIndex >= currentIndex ? "tab-slide-left" : "tab-slide-right";
  currentTab.value = nextTab;
};

const isMine = (message: Message) => message.senderId === MOCK_MY_USER_ID;
const messageDomId = (id: string) => `msg-${id}`;

const getContact = (userId: string) => contactsById.value.get(userId) || null;

const sessionRows = computed(() => {
  return sortedSessions.value.map((session) => {
    const contact = getContact(session.userId);
    const lastMessage = session.messages[session.messages.length - 1] || null;
    const previewText =
      lastMessage?.type === "image" ? "[Image]" : lastMessage?.content || "No messages yet";
    const displayTime = lastMessage ? formatTime(lastMessage.timestamp) : "";
    const nameLower = contact?.name?.toLowerCase() || "";
    const previewLower = previewText.toLowerCase();

    return {
      session,
      contact,
      previewText,
      displayTime,
      nameLower,
      previewLower,
    };
  });
});

const visibleSessionRows = computed(() => {
  const keyword = debouncedSearchKeyword.value;
  if (!keyword) {
    return sessionRows.value;
  }

  return sessionRows.value.filter((row) => {
    return row.nameLower.includes(keyword) || row.previewLower.includes(keyword);
  });
});

const selectedGroupMemberSet = computed(() => new Set(selectedGroupMemberIds.value));
const selectedGroupCount = computed(() => selectedGroupMemberIds.value.length);

const isGroupMemberSelected = (contactId: string) => {
  return selectedGroupMemberSet.value.has(contactId);
};

const getGroupMembers = (session: ChatSession): User[] => {
  if (!session.isGroup || !session.groupMemberIds || session.groupMemberIds.length === 0) {
    return [];
  }

  return session.groupMemberIds
    .map((memberId) => getContact(memberId))
    .filter((member): member is User => Boolean(member));
};

const canSelectAsGroupMember = (contact: User) => {
  if (contact.id === "file-helper" || contact.id === "group-rd") {
    return false;
  }
  return !contact.id.startsWith("group-custom-");
};

const contactRows = computed(() => {
  if (!groupCreateMode.value) {
    return contacts.value;
  }
  return contacts.value.filter((contact) => canSelectAsGroupMember(contact));
});

const pickGroupSpeakers = (session: ChatSession): User[] => {
  const members = getGroupMembers(session);
  if (members.length === 0) {
    return [];
  }
  if (members.length === 1) {
    return [members[0]];
  }

  const firstIndex = Math.floor(Math.random() * members.length);
  const first = members[firstIndex];
  const needSecond = Math.random() < 0.55;
  if (!needSecond) {
    return [first];
  }

  let secondIndex = firstIndex;
  while (secondIndex === firstIndex) {
    secondIndex = Math.floor(Math.random() * members.length);
  }
  return [first, members[secondIndex]];
};

const normalizeReply = (reply: string) => {
  return reply.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
};

const isServiceErrorReply = (reply: string) => {
  const normalized = normalizeReply(reply);
  return (
    normalized.includes("ai authentication failed") ||
    normalized.includes("server env is incomplete") ||
    normalized.includes("endpoint not found") ||
    normalized.includes("cannot reach ai service") ||
    normalized.includes("busy now")
  );
};

const pickByIndex = (pool: string[], index: number) => {
  if (pool.length === 0) {
    return "";
  }
  return pool[((index % pool.length) + pool.length) % pool.length];
};

const makeUniqueGroupReply = (
  rawReply: string,
  speaker: User,
  speakerIndex: number,
  usedReplies: Set<string>,
) => {
  const trimmed = rawReply.trim();
  const baseReply = trimmed.length > 0 ? trimmed : pickByIndex(groupFallbackReplies, speakerIndex);
  const prefix = pickByIndex(groupReplyPrefixes, speakerIndex);
  const suffix = pickByIndex(groupReplySuffixes, speakerIndex + 1);
  const candidates = isServiceErrorReply(baseReply)
    ? [
        pickByIndex(groupFallbackReplies, speakerIndex),
        pickByIndex(groupFallbackReplies, speakerIndex + 1),
        `${prefix} ${pickByIndex(groupFallbackReplies, speakerIndex + 2)}`,
      ]
    : [
        baseReply,
        `${prefix} ${baseReply}`,
        `${baseReply} ${suffix}`,
        `${prefix} ${baseReply} ${suffix}`,
      ];

  for (const candidate of candidates) {
    const normalized = normalizeReply(candidate);
    if (!normalized || usedReplies.has(normalized)) {
      continue;
    }
    usedReplies.add(normalized);
    return candidate;
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const fallback = `${prefix} ${baseReply} (update ${speakerIndex + attempt})`;
    const normalized = normalizeReply(fallback);
    if (!usedReplies.has(normalized)) {
      usedReplies.add(normalized);
      return fallback;
    }
  }

  const finalReply = `${speaker.name}: ${baseReply}`;
  usedReplies.add(normalizeReply(finalReply));
  return finalReply;
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const formatUnread = (count: number) => {
  if (count > 9999) {
    return "9999+";
  }
  return String(count);
};

const messageAvatar = (message: Message) => {
  if (isMine(message)) {
    return currentUser.avatar;
  }
  const sender = getContact(message.senderId);
  if (sender) {
    return sender.avatar;
  }
  return activeContact.value?.avatar || "";
};

const messageUserId = (message: Message) => {
  if (isMine(message)) {
    return currentUser.id;
  }
  const sender = getContact(message.senderId);
  if (sender) {
    return sender.id;
  }
  return activeContact.value?.id || "";
};

const messageSenderName = (message: Message) => {
  if (!activeSession.value?.isGroup || isMine(message)) {
    return "";
  }
  return getContact(message.senderId)?.name || "";
};

const activeMessageRows = computed(() => {
  const session = activeSession.value;
  if (!session) {
    return [];
  }
  const isGroup = Boolean(session.isGroup);

  return session.messages.map((message) => {
    const mine = message.senderId === MOCK_MY_USER_ID;
    const sender = mine ? currentUser : getContact(message.senderId);
    return {
      message,
      mine,
      entering: isMessageEntering(message.id),
      avatar: mine ? currentUser.avatar : sender?.avatar || activeContact.value?.avatar || "",
      senderId: mine ? currentUser.id : sender?.id || activeContact.value?.id || "",
      senderName: isGroup && !mine ? sender?.name || "" : "",
    };
  });
});

const markMessageEntering = (messageId: string) => {
  const nextIds = new Set(animatingMessageIds.value);
  nextIds.add(messageId);
  animatingMessageIds.value = nextIds;
  setTimeout(() => {
    if (!animatingMessageIds.value.has(messageId)) {
      return;
    }
    const afterIds = new Set(animatingMessageIds.value);
    afterIds.delete(messageId);
    animatingMessageIds.value = afterIds;
  }, 260);
};

const isMessageEntering = (messageId: string) => {
  return animatingMessageIds.value.has(messageId);
};

const updateSessionById = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
  const sessionIndex = sessions.value.findIndex((session) => session.id === sessionId);
  if (sessionIndex < 0) {
    return;
  }

  const nextSession = updater(sessions.value[sessionIndex]);
  const nextSessions = [...sessions.value];
  nextSessions[sessionIndex] = nextSession;
  sessions.value = nextSessions;
};

const appendMessagesToSession = (sessionId: string, messagesToAppend: Message[], bumpUnread: boolean) => {
  if (messagesToAppend.length === 0) {
    return;
  }

  updateSessionById(sessionId, (session) => {
    const nextUnread = bumpUnread
      ? activeSessionId.value === sessionId
        ? 0
        : session.unreadCount + messagesToAppend.length
      : session.unreadCount;

    return {
      ...session,
      unreadCount: nextUnread,
      messages: [...session.messages, ...messagesToAppend],
    };
  });

  for (const message of messagesToAppend) {
    markMessageEntering(message.id);
  }
};

const copyMessage = (message: Message) => {
  if (!message.content.trim()) {
    return;
  }
  uni.setClipboardData({
    data: message.content,
    success: () => {
      uni.showToast({
        title: "Copied",
        icon: "none",
      });
    },
  });
};

const scrollToBottom = () => {
  const session = activeSession.value;
  if (!session || session.messages.length === 0) {
    return;
  }
  messageScrollIntoView.value = messageDomId(session.messages[session.messages.length - 1].id);
};

watch(
  () => activeSession.value?.messages.length,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
);

watch(activeSessionId, () => {
  nextTick(() => {
    scrollToBottom();
  });
});

watch(
  searchKeyword,
  (value) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchKeyword.value = value.trim().toLowerCase();
    }, 120);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
});

const openSession = (sessionId: string) => {
  moreMenuOpen.value = false;
  emojiPanelOpen.value = false;
  chatListScrollTop.value = chatListSavedScrollTop.value;
  updateSessionById(sessionId, (session) =>
    session.unreadCount > 0 ? { ...session, unreadCount: 0 } : session,
  );
  activeSessionId.value = sessionId;
};

const backFromChat = () => {
  emojiPanelOpen.value = false;
  activeSessionId.value = null;
  nextTick(() => {
    chatListScrollTop.value = chatListSavedScrollTop.value;
  });
};

const openContact = (contactId: string) => {
  if (!contactId) {
    return;
  }
  viewingContactId.value = contactId;
};

const backFromContact = () => {
  viewingContactId.value = null;
};

const openSubPage = (page: SubPageType) => {
  subPage.value = page;
};

const backFromSubPage = () => {
  subPage.value = null;
};

const openSearch = () => {
  moreMenuOpen.value = false;
  emojiPanelOpen.value = false;
  searchOpen.value = true;
};

const closeSearch = () => {
  searchKeyword.value = "";
  debouncedSearchKeyword.value = "";
  searchOpen.value = false;
};

const clearSearch = () => {
  searchKeyword.value = "";
  debouncedSearchKeyword.value = "";
};

const handleMoreAction = () => {
  searchOpen.value = false;
  emojiPanelOpen.value = false;
  moreMenuOpen.value = !moreMenuOpen.value;
};

const closeMoreMenu = () => {
  moreMenuOpen.value = false;
};

const handleMenuRefresh = () => {
  closeMoreMenu();
  refreshChatTab();
};

const beginCreateGroup = () => {
  closeMoreMenu();
  closeSearch();
  groupCreateMode.value = true;
  selectedGroupMemberIds.value = [];
  switchTabWithSlide("contact");
};

const toggleGroupMember = (contactId: string) => {
  if (!groupCreateMode.value) {
    openContact(contactId);
    return;
  }

  const nextSet = new Set(selectedGroupMemberIds.value);
  if (nextSet.has(contactId)) {
    nextSet.delete(contactId);
  } else {
    nextSet.add(contactId);
  }
  selectedGroupMemberIds.value = [...nextSet];
};

const cancelCreateGroup = () => {
  groupCreateMode.value = false;
  selectedGroupMemberIds.value = [];
};

const createGroupFromSelected = () => {
  if (selectedGroupMemberIds.value.length === 0) {
    uni.showToast({
      title: "Select contacts first",
      icon: "none",
    });
    return;
  }

  const stamp = Date.now();
  const groupId = `group-custom-${stamp}`;
  const groupIndex = createdGroupCount.value;
  createdGroupCount.value += 1;

  const selectedContacts = contacts.value.filter((contact) =>
    selectedGroupMemberIds.value.includes(contact.id),
  );
  const memberNames = selectedContacts.map((contact) => contact.name);
  const groupName = `Group ${groupIndex}`;

  const groupUser: User = {
    id: groupId,
    name: groupName,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(`Group-${groupIndex}`)}`,
    region: "Online",
    signature: `${memberNames.length} members`,
    level: 5,
  };
  const groupLeadId = selectedGroupMemberIds.value[0] || groupId;

  const welcomeMessage: Message = {
    id: `msg-${groupId}-welcome`,
    senderId: groupLeadId,
    type: "text",
    content: `Group created with ${memberNames.join(", ")}.`,
    timestamp: stamp,
  };

  const newSession: ChatSession = {
    id: groupId,
    userId: groupId,
    unreadCount: 0,
    isGroup: true,
    groupMemberIds: selectedGroupMemberIds.value,
    messages: [welcomeMessage],
  };

  contacts.value = [groupUser, ...contacts.value];
  sessionPool.value = [newSession, ...sessionPool.value];
  sessionCursor.value = Math.min(sessionCursor.value + 1, sessionPool.value.length);
  sessions.value = [newSession, ...sessions.value];
  activeSessionId.value = groupId;
  groupCreateMode.value = false;
  selectedGroupMemberIds.value = [];
  switchTabWithSlide("chat");
  closeMoreMenu();
  uni.showToast({
    title: "Group created",
    icon: "none",
  });
};

const appendMoreSessions = (count: number) => {
  if (!chatListHasMore.value) {
    return;
  }

  const nextCursor = Math.min(sessionCursor.value + count, sessionPool.value.length);
  const nextPart = cloneSessions(sessionPool.value.slice(sessionCursor.value, nextCursor));
  if (nextPart.length > 0) {
    sessions.value = [...sessions.value, ...nextPart];
  }
  sessionCursor.value = nextCursor;
};

const handleChatListLoadMore = () => {
  const now = Date.now();
  if (
    chatListLoadingMore.value ||
    !chatListLoadMoreArmed.value ||
    !chatListHasMore.value ||
    searchKeyword.value.trim() ||
    now - chatListLastLoadMoreAt.value < 500
  ) {
    return;
  }

  chatListLastLoadMoreAt.value = now;
  chatListLoadMoreArmed.value = false;
  chatListLoadingMore.value = true;
  chatListLoadingText.value = "Loading...";

  setTimeout(() => {
    appendMoreSessions(loadMoreSize);
    chatListLoadingMore.value = false;
    chatListLoadingText.value = chatListHasMore.value ? "Pull up to load more" : "No more chats";
    chatListLastLoadMoreAt.value = Date.now();
  }, 280);
};

const handleChatListScroll = (event: any) => {
  const top = Number(event?.detail?.scrollTop ?? 0);
  if (!Number.isFinite(top)) {
    return;
  }
  if (top < chatListLastScrollTop.value - 8) {
    chatListLoadMoreArmed.value = true;
  }
  chatListLastScrollTop.value = top;
  chatListSavedScrollTop.value = top;
};

const refreshChatTab = () => {
  if (chatListRefresherTriggered.value) {
    return;
  }

  chatListRefresherTriggered.value = true;

  const top = sessions.value[0];
  if (top) {
    const lastMessage = top.messages[top.messages.length - 1];
    const refreshMessage: Message = {
      id: `msg-refresh-${Date.now()}`,
      senderId: top.userId,
      type: "text",
      content: "Refreshed: latest updates are synced.",
      timestamp: Date.now(),
    };

    sessions.value = sessions.value
      .map((session) => {
        if (session.id !== top.id) {
          return session;
        }
        return {
          ...session,
          unreadCount: activeSessionId.value === top.id ? 0 : Math.min(session.unreadCount + 1, 9),
          messages: lastMessage ? [...session.messages, refreshMessage] : [refreshMessage],
        };
      })
      .sort((a, b) => {
        const timeA = a.messages[a.messages.length - 1]?.timestamp || 0;
        const timeB = b.messages[b.messages.length - 1]?.timestamp || 0;
        return timeB - timeA;
      });
  }

  if (chatListHasMore.value) {
    appendMoreSessions(1);
  }

  chatListSavedScrollTop.value = 0;
  chatListLastScrollTop.value = 0;
  chatListLoadMoreArmed.value = true;
  chatListScrollTop.value = 0;
  chatListScrollIntoView.value = "chat-list-top";
  chatListRefreshing.value = true;
  setTimeout(() => {
    chatListRefreshing.value = false;
    chatListRefresherTriggered.value = false;
    chatListScrollIntoView.value = "";
  }, 220);
};

const handleChatListRefresh = () => {
  refreshChatTab();
};

const handleTabSelect = (tab: Tab) => {
  const now = Date.now();
  if (tab === "chat" && currentTab.value === "chat") {
    if (now - lastChatTabTapAt.value < 320) {
      refreshChatTab();
    }
    lastChatTabTapAt.value = now;
    return;
  }

  lastChatTabTapAt.value = tab === "chat" ? now : 0;
  if (tab !== "chat") {
    closeSearch();
    closeMoreMenu();
    emojiPanelOpen.value = false;
  }
  if (groupCreateMode.value && tab !== "contact") {
    cancelCreateGroup();
  }
  switchTabWithSlide(tab);
};

const startChatWithContact = (contactId: string) => {
  let session = sessions.value.find((item) => item.userId === contactId);

  if (!session) {
    session = {
      id: contactId,
      userId: contactId,
      unreadCount: 0,
      messages: [],
    };
    sessions.value = [session, ...sessions.value];
  }

  updateSessionById(session.id, (item) => (item.unreadCount > 0 ? { ...item, unreadCount: 0 } : item));
  activeSessionId.value = session.id;
  viewingContactId.value = null;
  switchTabWithSlide("chat");
  closeMoreMenu();
  emojiPanelOpen.value = false;
};

const sendMessage = async (sessionId: string, content: string, type: MessageType) => {
  const sessionSnapshot = sessions.value.find((item) => item.id === sessionId);
  if (!sessionSnapshot) {
    return;
  }
  const contact = getContact(sessionSnapshot.userId);

  const userMessage: Message = {
    id: `msg-${Date.now()}`,
    senderId: MOCK_MY_USER_ID,
    type,
    content,
    timestamp: Date.now(),
  };

  appendMessagesToSession(sessionId, [userMessage], false);

  nextTick(() => {
    scrollToBottom();
  });

  if (type !== "text") {
    return;
  }

  const currentMessages = [...sessionSnapshot.messages, userMessage];

  if (sessionSnapshot.isGroup) {
    const speakers = pickGroupSpeakers(sessionSnapshot);
    if (speakers.length === 0) {
      return;
    }

    const replyResults = await Promise.all(
      speakers.map(async (speaker, index) => {
        const reply = await getAIReply(currentMessages, speaker.name);
        return {
          speaker,
          index,
          reply,
        };
      }),
    );
    const usedReplies = new Set<string>();
    const batchTimestamp = Date.now();
    const groupMessages: Message[] = replyResults.map(({ speaker, index, reply }) => ({
      id: `msg-ai-${speaker.id}-${batchTimestamp}-${index}-${Math.floor(Math.random() * 1000)}`,
      senderId: speaker.id,
      type: "text",
      content: makeUniqueGroupReply(reply, speaker, index, usedReplies),
      timestamp: batchTimestamp + index,
    }));

    appendMessagesToSession(sessionId, groupMessages, true);

    nextTick(() => {
      scrollToBottom();
    });
    return;
  }

  if (!contact) {
    return;
  }

  const reply = await getAIReply(currentMessages, contact.name);
  const aiMessageId = `msg-ai-${Date.now()}`;
  appendMessagesToSession(
    sessionId,
    [
      {
        id: aiMessageId,
        senderId: contact.id,
        type: "text",
        content: reply,
        timestamp: Date.now(),
      },
    ],
    true,
  );

  nextTick(() => {
    scrollToBottom();
  });
};

const handleSendText = () => {
  if (!activeSessionId.value) {
    return;
  }

  const text = inputValue.value.trim();
  if (!text) {
    return;
  }

  inputValue.value = "";
  emojiPanelOpen.value = false;
  void sendMessage(activeSessionId.value, text, "text");
};

const handlePrimaryAction = () => {
  if (hasInputText.value) {
    handleSendText();
    return;
  }
  chooseImage();
};

const chooseImage = () => {
  if (!activeSessionId.value) {
    return;
  }
  emojiPanelOpen.value = false;

  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: (result) => {
      const path = result.tempFilePaths?.[0];
      if (!path) {
        return;
      }
      void sendMessage(activeSessionId.value as string, path, "image");
    },
  });
};

const previewImage = (url: string) => {
  uni.previewImage({
    current: url,
    urls: [url],
  });
};

const toggleEmojiPanel = () => {
  emojiPanelOpen.value = !emojiPanelOpen.value;
};

const appendEmoji = (emoji: string) => {
  inputValue.value = `${inputValue.value}${emoji}`;
};
</script>

<template>
  <view class="page-root">
    <view v-if="subPage" class="full-page">
      <view class="top-bar">
        <view class="back-btn" @tap="backFromSubPage">
          <uni-icons type="arrow-left" size="20" color="#0f172a" />
          <text class="back-label">Back</text>
        </view>
        <text class="top-title">{{ subPageTitle }}</text>
        <view class="top-placeholder" />
      </view>
      <scroll-view class="list-scroll" scroll-y>
        <view class="menu-card">
          <view v-for="item in subPageItems" :key="item" class="menu-item">
            <text class="menu-item-text">{{ item }}</text>
            <text class="menu-item-arrow">&gt;</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-else-if="viewingContact" class="full-page">
      <view class="top-bar">
        <view class="back-btn" @tap="backFromContact">
          <uni-icons type="arrow-left" size="20" color="#0f172a" />
          <text class="back-label">Back</text>
        </view>
        <text class="top-title">Contact</text>
        <view class="top-placeholder" />
      </view>
      <scroll-view class="list-scroll" scroll-y>
        <view class="contact-header">
          <image class="contact-avatar-lg" :src="viewingContact.avatar" mode="aspectFill" />
          <view class="contact-main">
            <text class="contact-name">{{ viewingContact.name }}</text>
            <text class="contact-id">ID: {{ viewingContact.id }}</text>
          </view>
        </view>
        <view class="contact-card">
          <view class="contact-row">
            <text class="contact-row-label">Region</text>
            <text class="contact-row-value">{{ viewingContact.region || "Unknown" }}</text>
          </view>
          <view class="contact-row">
            <text class="contact-row-label">Level</text>
            <text class="contact-row-value">Lv.{{ viewingContact.level || 1 }}</text>
          </view>
          <view class="contact-row">
            <text class="contact-row-label">Status</text>
            <text class="contact-row-value">{{ viewingContact.signature || "No signature" }}</text>
          </view>
        </view>
        <view v-if="viewingContact.id !== currentUser.id" class="contact-actions">
          <view class="action-btn" @tap="startChatWithContact(viewingContact.id)">Send Message</view>
        </view>
      </scroll-view>
    </view>

    <view v-else-if="activeSession && activeContact" class="chat-page">
      <view class="top-bar">
        <view class="back-btn back-btn-icon" @tap="backFromChat">
          <uni-icons type="arrow-left" size="22" color="#0f172a" />
        </view>
        <text class="top-title">{{ activeContact.name }}</text>
        <view class="top-placeholder compact" />
      </view>

      <scroll-view class="message-list" scroll-y :scroll-into-view="messageScrollIntoView">
        <view class="message-padding" />
        <view
          v-for="row in activeMessageRows"
          :id="messageDomId(row.message.id)"
          :key="row.message.id"
          class="message-row"
          :class="{ mine: row.mine, entering: row.entering }"
        >
          <image class="message-avatar" :src="row.avatar" mode="aspectFit" @tap="openContact(row.senderId)" />
          <view class="message-bubble" :class="{ mine: row.mine }">
            <text v-if="row.senderName" class="message-sender">{{ row.senderName }}</text>
            <text
              v-if="row.message.type === 'text'"
              class="message-text"
              selectable
              @longpress="copyMessage(row.message)"
              @longtap="copyMessage(row.message)"
            >{{ row.message.content }}</text>
            <image
              v-else
              class="message-image"
              :src="row.message.content"
              mode="widthFix"
              @tap="previewImage(row.message.content)"
              @longpress="copyMessage(row.message)"
              @longtap="copyMessage(row.message)"
            />
          </view>
        </view>
        <view class="message-padding" />
      </scroll-view>

      <view class="input-bar">
        <view class="input-shell">
          <view class="input-emoji-btn" :class="{ active: emojiPanelOpen }" @tap="toggleEmojiPanel">
            <view class="emoji-face">
              <view class="emoji-eye left" />
              <view class="emoji-eye right" />
              <view class="emoji-mouth" />
            </view>
          </view>
          <input
            v-model="inputValue"
            class="chat-input"
            placeholder="Message"
            confirm-type="send"
            @confirm="handleSendText"
          />
        </view>
        <view class="input-primary-btn" :class="{ active: hasInputText }" @tap="handlePrimaryAction">
          <view class="primary-icon-stack">
            <uni-icons
              type="paperclip"
              size="24"
              class="primary-icon clip"
              :class="{ show: !hasInputText }"
              color="#6b7380"
            />
            <uni-icons
              type="paperplane"
              size="22"
              class="primary-icon send"
              :class="{ show: hasInputText }"
              color="#ffffff"
            />
          </view>
        </view>
      </view>
      <view v-if="emojiPanelOpen" class="emoji-panel">
        <view
          v-for="emoji in emojiOptions"
          :key="emoji"
          class="emoji-item"
          @tap="appendEmoji(emoji)"
        >
          <text class="emoji-char">{{ emoji }}</text>
        </view>
      </view>
    </view>

    <view v-else class="full-page">
      <view class="content-area">
        <transition :name="tabTransitionName" mode="out-in">
          <view v-if="currentTab === 'chat'" key="chat" class="tab-page">
            <view class="header header-main">
              <text class="header-brand">LetWechat</text>
              <view class="header-actions">
                <view class="header-action-btn" @tap="openSearch">
                  <view class="icon-search">
                    <view class="icon-search-ring" />
                    <view class="icon-search-handle" />
                  </view>
                </view>
                <view class="header-action-btn" :class="{ open: moreMenuOpen }" @tap="handleMoreAction">
                  <view class="icon-more">
                    <view class="icon-more-dot" />
                    <view class="icon-more-dot" />
                    <view class="icon-more-dot" />
                  </view>
                </view>
              </view>
            </view>
            <view v-if="moreMenuOpen" class="header-menu-mask" @tap="closeMoreMenu" />
            <view class="header-menu-panel" :class="{ open: moreMenuOpen }">
              <view class="header-menu-item" @tap="beginCreateGroup">
                <view class="header-menu-icon">
                  <view class="menu-group-icon">
                    <view class="menu-group-head left" />
                    <view class="menu-group-head right" />
                    <view class="menu-group-plus v" />
                    <view class="menu-group-plus h" />
                  </view>
                </view>
                <text class="header-menu-text">Create Group</text>
              </view>
              <view class="header-menu-item" @tap="handleMenuRefresh">
                <view class="header-menu-icon">
                  <view class="menu-refresh-icon">
                    <view class="menu-refresh-ring" />
                    <view class="menu-refresh-head" />
                  </view>
                </view>
                <text class="header-menu-text">Refresh Chats</text>
              </view>
            </view>
            <view class="search-wrap" :class="{ open: searchOpen }">
              <view class="search-box">
                <view class="search-box-icon">
                  <view class="icon-search-ring" />
                  <view class="icon-search-handle" />
                </view>
                <input
                  v-model="searchKeyword"
                  class="search-input"
                  placeholder="Search"
                  :focus="searchOpen"
                  confirm-type="search"
                />
                <view v-if="searchKeyword" class="search-clear-btn" @tap="clearSearch">
                  <view class="search-clear-line line-a" />
                  <view class="search-clear-line line-b" />
                </view>
              </view>
              <view class="search-cancel" @tap="closeSearch">Cancel</view>
            </view>
            <scroll-view
              class="list-scroll with-tabbar chat-list-scroll"
              :class="{ 'chat-list-refreshing': chatListRefreshing }"
              scroll-y
              :scroll-top="chatListScrollTop"
              :scroll-into-view="chatListScrollIntoView"
              refresher-enabled
              :refresher-triggered="chatListRefresherTriggered"
              @scroll="handleChatListScroll"
              @refresherrefresh="handleChatListRefresh"
              @scrolltolower="handleChatListLoadMore"
              :lower-threshold="80"
            >
              <view id="chat-list-top" class="list-anchor" />
              <view v-if="visibleSessionRows.length === 0" class="chat-empty">No chat results</view>
              <view v-for="row in visibleSessionRows" :key="row.session.id" class="chat-item" @tap="openSession(row.session.id)">
                <view class="chat-avatar-wrap">
                  <image class="chat-avatar" :src="row.contact?.avatar" mode="aspectFill" />
                </view>
                <view class="chat-main">
                  <view class="chat-title-row">
                    <view class="chat-name-wrap">
                      <text class="chat-name">{{ row.contact?.name || "Unknown" }}</text>
                      <view v-if="row.session.isGroup" class="chat-muted-icon" />
                    </view>
                    <text class="chat-time" :class="{ hot: row.session.unreadCount > 0 }">{{ row.displayTime }}</text>
                  </view>
                  <view class="chat-sub-row">
                    <text class="chat-preview">{{ row.previewText }}</text>
                    <view
                      v-if="row.session.unreadCount > 0"
                      class="chat-unread"
                      :class="{ hot: row.session.unreadCount > 99 }"
                    >
                      {{ formatUnread(row.session.unreadCount) }}
                    </view>
                  </view>
                </view>
              </view>
              <view v-if="!searchKeyword.trim()" class="chat-list-footer">
                <text class="chat-list-footer-text">{{ chatListLoadingText }}</text>
              </view>
            </scroll-view>
          </view>

          <view v-else-if="currentTab === 'contact'" key="contact" class="tab-page">
            <view v-if="groupCreateMode" class="header header-contact-mode">
              <view class="group-header-btn" @tap="cancelCreateGroup">Cancel</view>
              <text class="header-title">Select Contacts</text>
              <view class="group-header-btn done" :class="{ disabled: selectedGroupCount === 0 }" @tap="createGroupFromSelected">
                Create ({{ selectedGroupCount }})
              </view>
            </view>
            <scroll-view class="list-scroll with-tabbar" scroll-y>
              <view v-if="groupCreateMode && contactRows.length === 0" class="chat-empty">No selectable contacts</view>
              <view
                v-for="contact in contactRows"
                :key="contact.id"
                class="contact-list-item"
                @tap="toggleGroupMember(contact.id)"
              >
                <image class="contact-avatar" :src="contact.avatar" mode="aspectFill" />
                <text class="contact-list-name">{{ contact.name }}</text>
                <view v-if="groupCreateMode" class="contact-check" :class="{ selected: isGroupMemberSelected(contact.id) }">
                  <view v-if="isGroupMemberSelected(contact.id)" class="contact-check-mark a" />
                  <view v-if="isGroupMemberSelected(contact.id)" class="contact-check-mark b" />
                </view>
              </view>
            </scroll-view>
          </view>

          <view v-else key="profile" class="tab-page">
            <scroll-view class="list-scroll with-tabbar" scroll-y>
              <view class="profile-card">
                <image class="profile-avatar" :src="currentUser.avatar" mode="aspectFit" />
                <view class="profile-meta">
                  <text class="profile-name">{{ currentUser.name }}</text>
                  <text class="profile-id">LetWechat ID: {{ currentUser.id }}</text>
                </view>
              </view>

              <view class="menu-card">
                <view v-for="item in profileMenus" :key="item.key" class="menu-item" @tap="openSubPage(item.key)">
                  <text class="menu-item-text">{{ item.label }}</text>
                  <text class="menu-item-arrow">&gt;</text>
                </view>
              </view>
            </scroll-view>
          </view>
        </transition>
      </view>

      <view class="tab-bar">
        <view class="tab-active-pill" :style="tabActivePillStyle" />
        <view class="tab-item" :class="{ active: currentTab === 'chat' }" @tap="handleTabSelect('chat')">
          <view class="tab-icon-wrap">
            <uni-icons
              class="tab-icon-real"
              :type="currentTab === 'chat' ? 'chatboxes-filled' : 'chatboxes'"
              :size="24"
              :color="currentTab === 'chat' ? '#006eff' : '#6f7b88'"
            />
            <view v-if="totalUnread > 0" class="tab-badge">{{ totalUnread }}</view>
          </view>
          <text class="tab-text">Chats</text>
        </view>
        <view class="tab-item" :class="{ active: currentTab === 'contact' }" @tap="handleTabSelect('contact')">
          <uni-icons
            class="tab-icon-real"
            :type="currentTab === 'contact' ? 'person-filled' : 'person'"
            :size="24"
            :color="currentTab === 'contact' ? '#006eff' : '#6f7b88'"
          />
          <text class="tab-text">Contacts</text>
        </view>
        <view class="tab-item" :class="{ active: currentTab === 'profile' }" @tap="handleTabSelect('profile')">
          <uni-icons
            class="tab-icon-real"
            :type="currentTab === 'profile' ? 'settings-filled' : 'settings'"
            :size="24"
            :color="currentTab === 'profile' ? '#006eff' : '#6f7b88'"
          />
          <text class="tab-text">Settings</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page-root {
  height: 100%;
  background: #f4f5f7;
  overflow-x: hidden;
}

.full-page,
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  animation: pane-in 180ms linear;
  overflow-x: hidden;
}

.tab-page {
  height: 100%;
  animation: pane-in 180ms linear;
  overflow-x: hidden;
}

.tab-slide-left-enter-active,
.tab-slide-right-enter-active {
  transition: transform 240ms linear;
}

.tab-slide-left-leave-active,
.tab-slide-right-leave-active {
  transition: opacity 240ms linear, transform 240ms linear;
}

.tab-slide-left-enter-from {
  opacity: 1;
  transform: translateX(26px);
}

.tab-slide-left-leave-to {
  opacity: 0;
  transform: translateX(-26px);
}

.tab-slide-right-enter-from {
  opacity: 1;
  transform: translateX(-26px);
}

.tab-slide-right-leave-to {
  opacity: 0;
  transform: translateX(26px);
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.top-bar {
  height: 52px;
  background: rgba(247, 249, 252, 0.94);
  border-bottom: 1px solid #dde4ef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  backdrop-filter: blur(6px);
}

.back-btn {
  min-width: 88px;
  height: 34px;
  border-radius: 17px;
  background: #ffffff;
  color: #111111;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 10px;
  box-shadow: 0 2px 10px rgba(17, 17, 17, 0.08);
  transition: transform 160ms linear, opacity 160ms linear, background-color 160ms linear;
}

.back-btn-icon {
  min-width: 40px;
  width: 40px;
  justify-content: center;
  padding: 0;
}

.back-btn:active {
  transform: scale(0.97);
  background: #f2f5fa;
}

.back-chevron {
  color: #0f172a;
  font-size: 26px;
  line-height: 1;
  font-weight: 700;
  transform: translateY(-1px);
}

.back-label {
  margin-left: 4px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.top-title {
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.top-placeholder {
  width: 90px;
}

.top-placeholder.compact {
  width: 40px;
}

.header {
  height: 56px;
  border-bottom: 1px solid #e4e9f0;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-main {
  height: calc(78px + env(safe-area-inset-top));
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  padding-bottom: 12px;
}

.header-brand {
  color: #2795dc;
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.2px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-action-btn {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: #f7f9fc;
  border: 1px solid #e5ebf3;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 160ms linear, background-color 160ms linear;
}

.header-action-btn:active {
  transform: scale(0.96);
  background: #edf2f8;
}

.header-action-btn.open {
  background: #e9f2ff;
  border-color: #d2e5ff;
}

.icon-search {
  width: 18px;
  height: 18px;
  position: relative;
}

.icon-search-ring {
  width: 13px;
  height: 13px;
  border: 2px solid #1f2937;
  border-radius: 50%;
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
}

.icon-search-handle {
  width: 8px;
  height: 2px;
  background: #1f2937;
  border-radius: 2px;
  position: absolute;
  right: 0;
  bottom: 1px;
  transform: rotate(45deg);
  transform-origin: right center;
}

.icon-more {
  width: 4px;
  height: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}

.icon-more-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #1f2937;
}

.header-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 72;
}

.header-menu-panel {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 84px);
  right: 16px;
  width: 224px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #dde8f7;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
  overflow: hidden;
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  pointer-events: none;
  transition: opacity 180ms linear, transform 180ms linear;
  z-index: 78;
}

.header-menu-panel.open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.header-menu-item {
  height: 50px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 10px;
  border-bottom: 1px solid #edf2f8;
  transition: background-color 160ms linear;
}

.header-menu-item:last-child {
  border-bottom: 0;
}

.header-menu-item:active {
  background: #f3f8ff;
}

.header-menu-icon {
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background: #eef5ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f6ed4;
}

.header-menu-text {
  color: #10243f;
  font-size: 14px;
  font-weight: 600;
}

.menu-group-icon {
  width: 16px;
  height: 16px;
  position: relative;
}

.menu-group-head {
  position: absolute;
  top: 1px;
  width: 6px;
  height: 6px;
  border: 1.6px solid currentColor;
  border-radius: 50%;
  box-sizing: border-box;
}

.menu-group-head.left {
  left: 1px;
}

.menu-group-head.right {
  right: 1px;
}

.menu-group-plus {
  position: absolute;
  background: currentColor;
  border-radius: 1px;
}

.menu-group-plus.v {
  right: 0;
  bottom: 2px;
  width: 1.8px;
  height: 8px;
}

.menu-group-plus.h {
  right: -3px;
  bottom: 5px;
  width: 8px;
  height: 1.8px;
}

.menu-refresh-icon {
  width: 16px;
  height: 16px;
  position: relative;
}

.menu-refresh-ring {
  width: 14px;
  height: 14px;
  border: 1.8px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  position: absolute;
  left: 1px;
  top: 1px;
  box-sizing: border-box;
}

.menu-refresh-head {
  position: absolute;
  right: 0;
  top: 2px;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid currentColor;
}

.header-title {
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.header-contact-mode {
  justify-content: space-between;
  padding: 0 12px;
}

.group-header-btn {
  min-width: 76px;
  color: #4b5563;
  font-size: 14px;
  line-height: 1;
}

.group-header-btn.done {
  text-align: right;
  color: #006eff;
  font-weight: 700;
}

.group-header-btn.done.disabled {
  color: #aeb8c4;
}

.group-header-placeholder {
  min-width: 76px;
}

.search-wrap {
  height: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-10px);
  padding: 0 12px;
  background: #ffffff;
  border-bottom: 0 solid #e8edf4;
  display: flex;
  align-items: center;
  transition: height 220ms linear, opacity 220ms linear, transform 220ms linear, border-width 220ms linear;
}

.search-wrap.open {
  height: 54px;
  opacity: 1;
  transform: translateY(0);
  border-bottom-width: 1px;
}

.search-box {
  flex: 1;
  height: 36px;
  border-radius: 11px;
  background: #f2f4f7;
  display: flex;
  align-items: center;
  padding: 0 10px;
  transform: scale(0.98);
  transition: transform 220ms linear, background-color 220ms linear;
}

.search-wrap.open .search-box {
  transform: scale(1);
}

.search-box-icon {
  width: 18px;
  height: 18px;
  position: relative;
  margin-right: 8px;
  opacity: 0.65;
}

.search-input {
  flex: 1;
  height: 30px;
  color: #111827;
  font-size: 15px;
}

.search-clear-btn {
  width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #c5cdd8;
  position: relative;
}

.search-clear-line {
  position: absolute;
  left: 4px;
  top: 8px;
  width: 10px;
  height: 2px;
  background: #ffffff;
  border-radius: 2px;
}

.search-clear-line.line-a {
  transform: rotate(45deg);
}

.search-clear-line.line-b {
  transform: rotate(-45deg);
}

.search-cancel {
  width: 0;
  opacity: 0;
  overflow: hidden;
  margin-left: 0;
  color: #2878c8;
  font-size: 15px;
  transition: width 220ms linear, opacity 220ms linear, margin-left 220ms linear;
}

.search-wrap.open .search-cancel {
  width: 52px;
  opacity: 1;
  margin-left: 10px;
}

.list-scroll {
  flex: 1;
  min-height: 0;
}

.with-tabbar {
  padding-bottom: calc(112px + env(safe-area-inset-bottom));
}

.list-anchor {
  height: 1px;
}

.chat-list-refreshing {
  animation: list-refresh 220ms linear;
}

.chat-list-scroll {
  background: #ffffff;
}

.chat-item {
  background: #ffffff;
  border-bottom: 1px solid #eef2f6;
  display: flex;
  align-items: center;
  padding: 13px 14px;
  transition: background-color 160ms linear, opacity 160ms linear;
}

.chat-item:active {
  background: #f4f8fc;
}

.chat-avatar-wrap {
  position: relative;
  margin-right: 12px;
}

.chat-avatar {
  width: 58px;
  height: 58px;
  border-radius: 29px;
  background: #d9d9d9;
}

.chat-main {
  flex: 1;
  min-width: 0;
}

.chat-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-name-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.chat-name {
  flex: 1;
  min-width: 0;
  color: #13151a;
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-muted-icon {
  width: 10px;
  height: 10px;
  border-left: 2px solid #c0c6cf;
  border-right: 2px solid #c0c6cf;
  transform: rotate(45deg);
  border-radius: 1px;
}

.chat-time {
  margin-left: 8px;
  flex-shrink: 0;
  white-space: nowrap;
  color: #9ba3ad;
  font-size: 13px;
  line-height: 1.2;
}

.chat-time.hot {
  color: #2a97df;
  font-weight: 700;
}

.chat-sub-row {
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.chat-preview {
  flex: 1;
  min-width: 0;
  color: #7d868f;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-unread {
  min-width: 24px;
  height: 24px;
  border-radius: 12px;
  padding: 0 7px;
  background: #006eff;
  color: #ffffff;
  font-size: 12px;
  line-height: 24px;
  text-align: center;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}

.chat-unread.hot {
  background: #006eff;
}

.chat-empty {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa3af;
  font-size: 16px;
}

.chat-list-footer {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-list-footer-text {
  color: #a1aab6;
  font-size: 13px;
}

.contact-list-item {
  background: #ffffff;
  border-bottom: 1px solid #eef2f6;
  display: flex;
  align-items: center;
  padding: 12px 14px;
  transition: background-color 160ms linear, opacity 160ms linear;
}

.contact-list-item:active {
  background: #f4f8fc;
}

.contact-avatar {
  width: 52px;
  height: 52px;
  border-radius: 26px;
  background: #d9d9d9;
  margin-right: 12px;
}

.contact-list-name {
  color: #111111;
  font-size: 16px;
}

.contact-check {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 11px;
  border: 1.8px solid #c8d1dd;
  position: relative;
  box-sizing: border-box;
  transition: border-color 140ms linear, background-color 140ms linear;
}

.contact-check.selected {
  border-color: #006eff;
  background: #006eff;
}

.contact-check-mark {
  position: absolute;
  height: 2px;
  background: #ffffff;
  border-radius: 2px;
}

.contact-check-mark.a {
  width: 6px;
  left: 5px;
  top: 11px;
  transform: rotate(42deg);
}

.contact-check-mark.b {
  width: 10px;
  left: 8px;
  top: 9px;
  transform: rotate(-46deg);
}

.profile-card {
  margin-top: 16px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e5ebf3;
  border-radius: 16px;
  padding: 24px 18px;
  display: flex;
  align-items: center;
  margin-left: 10px;
  margin-right: 10px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background: #ffffff;
  margin-right: 14px;
  overflow: hidden;
  border: 1px solid #e3e8ef;
}

.profile-meta {
  display: flex;
  flex-direction: column;
}

.profile-name {
  color: #111111;
  font-size: 22px;
  font-weight: 700;
}

.profile-id {
  margin-top: 6px;
  color: #7a7a7a;
  font-size: 13px;
}

.menu-card {
  background: rgba(255, 255, 255, 0.96);
  margin-top: 12px;
  border: 1px solid #e5ebf3;
  border-radius: 14px;
  margin-left: 10px;
  margin-right: 10px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.menu-item {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #f2f2f2;
  transition: background-color 160ms linear, opacity 160ms linear;
}

.menu-item:last-child {
  border-bottom: 0;
}

.menu-item:active {
  background: #f4f8fc;
}

.menu-item-text {
  color: #111111;
  font-size: 16px;
}

.menu-item-arrow {
  color: #bbbbbb;
  font-size: 16px;
}

.tab-bar {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: calc(8px + env(safe-area-inset-bottom));
  height: 66px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e5eaf1;
  border-radius: 33px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  z-index: 50;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(10px);
  overflow: hidden;
  pointer-events: none;
}

.tab-active-pill {
  position: absolute;
  left: 8px;
  top: 7px;
  width: calc((100% - 16px) / 3);
  height: 52px;
  border-radius: 26px;
  background: #e8f3ff;
  transition: transform 220ms linear;
  z-index: 0;
}

.tab-item {
  flex: 1;
  height: 52px;
  border-radius: 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6f7b88;
  transition: transform 140ms linear, background-color 140ms linear, opacity 140ms linear;
  position: relative;
  z-index: 1;
  pointer-events: auto;
}

.tab-item:active {
  transform: scale(0.96);
}

.tab-item.active {
  background: transparent;
  color: #006eff;
}

.tab-item.active .tab-text {
  color: #006eff;
  font-weight: 700;
}

.tab-icon-wrap {
  position: relative;
}

.tab-icon-real {
  opacity: 0.92;
  transition: transform 140ms linear, opacity 140ms linear;
}

.tab-item.active .tab-icon-real {
  opacity: 1;
  transform: translateY(-1px) scale(1.04);
}

.tab-text {
  margin-top: 3px;
  color: #5f6975;
  font-size: 13px;
  transition: color 140ms linear;
}

.tab-badge {
  position: absolute;
  top: -8px;
  right: -13px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #006eff;
  color: #ffffff;
  font-size: 10px;
  line-height: 18px;
  text-align: center;
  padding: 0 4px;
}

.chat-page {
  background: linear-gradient(180deg, #f6f8fb 0%, #eef1f6 45%, #e8ecf3 100%);
}

.message-list {
  flex: 1;
  min-height: 0;
  padding: 0 0 8px;
}

.message-padding {
  height: 10px;
}

.message-row {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 0 12px;
  margin-bottom: 14px;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-row.entering {
  animation: msg-in 220ms linear;
}

.message-avatar {
  width: 40px;
  height: 40px;
  display: block;
  border-radius: 20px;
  background: #ffffff;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid #e3e8ef;
  box-sizing: border-box;
}

.message-bubble {
  max-width: 70%;
  margin-left: 0;
  background: #ffffff;
  border-radius: 10px;
  padding: 10px 12px;
  min-width: 0;
  overflow: hidden;
  margin-left: 5px;
}

.message-bubble.mine {
  margin-left: 0;
  margin-right: 5px;
  background: #95ec69;
}

.message-row.mine .message-bubble {
  order: 1;
}

.message-row.mine .message-avatar {
  order: 2;
}

.message-text {
  display: block;
  max-width: 100%;
  color: #111111;
  font-size: 15px;
  line-height: 22px;
  user-select: text;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.message-sender {
  display: block;
  margin-bottom: 4px;
  color: #5f6b78;
  font-size: 12px;
}

.message-image {
  width: 160px;
  border-radius: 6px;
}

.input-bar {
  min-height: 74px;
  background: rgba(248, 250, 253, 0.9);
  border-top: 1px solid #dce3ee;
  padding: 8px 10px calc(10px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(8px);
  width: 100%;
  box-sizing: border-box;
}

.input-shell {
  flex: 1;
  min-width: 0;
  height: 52px;
  border-radius: 26px;
  background: #f1f3f3;
  border: 1px solid #d9dee6;
  display: flex;
  align-items: center;
  padding: 0 8px 0 6px;
  transition: border-color 160ms linear, background-color 160ms linear;
}

.input-emoji-btn {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 140ms linear, background-color 140ms linear;
}

.input-emoji-btn.active {
  background: #e8edf3;
}

.input-emoji-btn:active {
  transform: scale(0.95);
}

.emoji-face {
  width: 21px;
  height: 21px;
  border: 1.9px solid #6d7680;
  border-radius: 50%;
  position: relative;
  box-sizing: border-box;
}

.emoji-eye {
  position: absolute;
  top: 6px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #6d7680;
}

.emoji-eye.left {
  left: 5px;
}

.emoji-eye.right {
  right: 5px;
}

.emoji-mouth {
  position: absolute;
  left: 5px;
  bottom: 5px;
  width: 9px;
  height: 4px;
  border-bottom: 1.9px solid #6d7680;
  border-radius: 0 0 6px 6px;
}

.emoji-panel {
  max-height: 168px;
  overflow-y: auto;
  background: #ffffff;
  border-top: 1px solid #dce3ee;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
}

.emoji-item {
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 140ms linear;
}

.emoji-item:active {
  background: #edf3fb;
}

.emoji-char {
  font-size: 22px;
  line-height: 1;
}

.chat-input {
  flex: 1;
  height: 40px;
  background: transparent;
  border-radius: 20px;
  padding: 0 6px 0 2px;
  font-size: 16px;
  color: #1f2937;
}

.input-primary-btn {
  width: 52px;
  height: 52px;
  border-radius: 26px;
  background: #eef2f6;
  border: 1px solid #d7dfe9;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 160ms linear, background-color 180ms linear, border-color 180ms linear;
  flex-shrink: 0;
}

.input-primary-btn.active {
  background: #2f9de6;
  border-color: #2f9de6;
}

.input-primary-btn:active {
  transform: scale(0.96);
}

.primary-icon-stack {
  width: 24px;
  height: 24px;
  position: relative;
}

.primary-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scale(0.84);
  opacity: 0;
  transition: opacity 180ms linear, transform 180ms linear;
}

.primary-icon.show {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.contact-header {
  background: rgba(255, 255, 255, 0.96);
  margin-top: 10px;
  padding: 18px 14px;
  display: flex;
  align-items: center;
  border: 1px solid #e5ebf3;
  border-radius: 14px;
  margin-left: 10px;
  margin-right: 10px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.contact-avatar-lg {
  width: 66px;
  height: 66px;
  border-radius: 8px;
  background: #d9d9d9;
  margin-right: 14px;
}

.contact-main {
  display: flex;
  flex-direction: column;
}

.contact-name {
  color: #111111;
  font-size: 22px;
  font-weight: 700;
}

.contact-id {
  margin-top: 6px;
  color: #7a7a7a;
  font-size: 13px;
}

.contact-card {
  background: rgba(255, 255, 255, 0.96);
  margin-top: 10px;
  border: 1px solid #e5ebf3;
  border-radius: 14px;
  margin-left: 10px;
  margin-right: 10px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.contact-row {
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid #f2f2f2;
}

.contact-row:last-child {
  border-bottom: 0;
}

.contact-row-label {
  color: #111111;
  font-size: 15px;
  font-weight: 600;
}

.contact-row-value {
  color: #666666;
  font-size: 14px;
}

.contact-actions {
  margin-top: 12px;
  padding: 0 14px;
}

.action-btn {
  height: 44px;
  border-radius: 10px;
  background: #07c160;
  color: #ffffff;
  text-align: center;
  line-height: 44px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 6px 16px rgba(7, 193, 96, 0.26);
  transition: transform 160ms linear, opacity 160ms linear, background-color 160ms linear;
}

.action-btn:active {
  transform: scale(0.98);
}

@keyframes pane-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes list-refresh {
  from {
    opacity: 0.75;
    transform: scale(0.995);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes msg-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 390px) {
  .chat-item {
    padding: 11px 10px;
  }

  .chat-avatar {
    width: 52px;
    height: 52px;
    border-radius: 26px;
  }

  .chat-name {
    font-size: 16px;
  }

  .chat-time {
    font-size: 12px;
  }

  .chat-preview {
    font-size: 14px;
  }

  .chat-unread {
    min-width: 22px;
    height: 22px;
    line-height: 22px;
    font-size: 11px;
    padding: 0 6px;
  }
}
</style>
