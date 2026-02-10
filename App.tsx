import React, { useState, useEffect, useRef } from 'react';
import { generateContacts, generateInitialSessions, currentUser } from './services/mockData';
import { getAIReply } from './services/ai';
import { User, ChatSession, Tab } from './types';
import { ChatList } from './components/ChatList';
import { ChatDetail } from './components/ChatDetail';
import { TabBar } from './components/TabBar';
import { ContactDetail } from './components/ContactDetail';
import { SubPage } from './components/SubPages';
import { MOCK_MY_USER_ID } from './constants';
import { ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  // --- Global State (Simulating Store) ---
  const [contacts] = useState<User[]>(generateContacts());
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentTab, setCurrentTab] = useState<Tab>('chat');
  
  // Navigation State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<'settings' | 'general' | null>(null);

  // Refresh Logic for Double Tap
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const lastChatTabClickRef = useRef<number>(0);

  // Ref to track active session ID in async callbacks (like AI replies)
  const activeSessionIdRef = useRef<string | null>(activeSessionId);

  // Initialize
  useEffect(() => {
    setSessions(generateInitialSessions(contacts));
  }, [contacts]);

  // Sync ref with state
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // --- Actions ---

  const handleTabSelect = (tab: Tab) => {
    if (tab === 'chat' && currentTab === 'chat') {
      const now = Date.now();
      // Check for double click (within 300ms)
      if (now - lastChatTabClickRef.current < 300) {
        setRefreshTrigger(prev => prev + 1);
      }
      lastChatTabClickRef.current = now;
    }
    setCurrentTab(tab);
  };

  const sendMessage = async (sessionId: string, content: string, type: 'text' | 'image') => {
    // 1. Add User Message immediately
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          messages: [
            ...session.messages,
            {
              id: `msg-${Date.now()}`,
              senderId: MOCK_MY_USER_ID,
              type,
              content,
              timestamp: Date.now()
            }
          ]
        };
      }
      return session;
    }));

    // 2. Trigger AI Reply if it's a text message
    if (type === 'text') {
      const session = sessions.find(s => s.id === sessionId);
      const contact = contacts.find(c => c.id === session?.userId);
      
      if (contact && session) {
        const currentMessages = [
            ...session.messages, 
            { id: 'temp', senderId: MOCK_MY_USER_ID, type: 'text', content, timestamp: Date.now() }
        ] as any;

        try {
            const reply = await getAIReply(currentMessages, contact.name);
            
            // Add AI Message
            setSessions(prev => prev.map(s => {
                if (s.id === sessionId) {
                    // Check if the user is currently looking at this session
                    // We use the ref because state inside this callback might be stale
                    const isViewingThisChat = activeSessionIdRef.current === sessionId;

                    return {
                        ...s,
                        // Increment unread count ONLY if the user is NOT in this chat
                        unreadCount: isViewingThisChat ? 0 : s.unreadCount + 1,
                        messages: [
                            ...s.messages,
                            {
                                id: `msg-ai-${Date.now()}`,
                                senderId: contact.id,
                                type: 'text',
                                content: reply,
                                timestamp: Date.now()
                            }
                        ]
                    };
                }
                return s;
            }));
        } catch (e) {
            console.error(e);
        }
      }
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, unreadCount: 0 } : s));
    setActiveSessionId(sessionId);
  };

  const startChatWithContact = (contactId: string) => {
    const existing = sessions.find(s => s.userId === contactId);
    if (existing) {
      handleSessionSelect(existing.id);
    } else {
        const newSession: ChatSession = {
            id: contactId,
            userId: contactId,
            unreadCount: 0,
            messages: []
        };
        setSessions([newSession, ...sessions]);
        setActiveSessionId(contactId);
    }
    setViewingContactId(null);
  };

  // --- Render Views ---

  // 1. Sub Pages (Settings/General) - Highest priority overlay
  if (subPage) {
    return <SubPage type={subPage} onBack={() => setSubPage(null)} />;
  }

  // 2. Contact Detail View (Render BEFORE ChatDetail to allow overlaying)
  if (viewingContactId) {
      const contact = contacts.find(c => c.id === viewingContactId);
      // Handle case if viewing "Me" from chat
      const targetUser = contact || (viewingContactId === currentUser.id ? currentUser : null);

      if (targetUser) {
          return (
            <ContactDetail 
                contact={targetUser} 
                onBack={() => setViewingContactId(null)}
                onSendMessage={() => startChatWithContact(targetUser.id)}
            />
          );
      }
  }

  // 3. Chat Detail View
  if (activeSessionId) {
    const session = sessions.find(s => s.id === activeSessionId);
    const contact = contacts.find(c => c.id === session?.userId);
    
    if (session && contact) {
      return (
        <ChatDetail 
          session={session} 
          contact={contact} 
          currentUser={currentUser}
          onBack={() => setActiveSessionId(null)}
          onSendMessage={sendMessage}
          onViewProfile={(userId) => setViewingContactId(userId)}
        />
      );
    }
  }

  // 4. Tab Views
  const renderTabContent = () => {
    switch (currentTab) {
      case 'chat':
        return (
          <ChatList 
            sessions={sessions} 
            contacts={contacts} 
            onSelectSession={handleSessionSelect}
            refreshTrigger={refreshTrigger} 
          />
        );
      case 'contact':
        return (
          <div className="flex flex-col h-full bg-[#ededed]">
             <div className="h-[44px] bg-[#ededed] flex items-center justify-center border-b border-gray-200 font-medium text-black">Contacts</div>
             <div className="flex-1 overflow-y-auto pb-[60px]">
                {contacts.map(c => (
                    <div 
                        key={c.id} 
                        onClick={() => setViewingContactId(c.id)}
                        className="flex items-center p-3 bg-white border-b border-gray-100 active:bg-gray-100"
                    >
                        <img src={c.avatar} className="w-10 h-10 rounded-md bg-gray-200 mr-3" />
                        {/* Enforcing text-black */}
                        <span className="text-black text-[16px]">{c.name}</span>
                    </div>
                ))}
             </div>
          </div>
        );
      case 'profile':
        return (
          <div className="flex flex-col h-full bg-[#ededed] pt-10">
             <div className="bg-white p-6 flex items-center mb-2 border-y border-[#e5e5e5]">
                <img src={currentUser.avatar} className="w-16 h-16 rounded-md bg-gray-200 mr-4"/>
                <div>
                    <h2 className="text-xl font-bold text-black">{currentUser.name}</h2>
                    <p className="text-gray-500 text-sm">WeChat ID: {currentUser.id}</p>
                </div>
             </div>
             
             <div className="bg-white border-y border-[#e5e5e5] mt-2">
               <div 
                 onClick={() => setSubPage('settings')}
                 className="p-4 flex justify-between items-center active:bg-gray-100 border-b border-[#e5e5e5] cursor-pointer"
               >
                 <span className="text-black text-[16px]">Settings</span>
                 <ChevronRight className="text-gray-300" size={20} />
               </div>
               <div 
                 onClick={() => setSubPage('general')}
                 className="p-4 flex justify-between items-center active:bg-gray-100 cursor-pointer"
               >
                 <span className="text-black text-[16px]">General</span>
                 <ChevronRight className="text-gray-300" size={20} />
               </div>
             </div>
          </div>
        );
    }
  };

  const totalUnread = sessions.reduce((acc, curr) => acc + curr.unreadCount, 0);

  return (
    <div className="h-full w-full max-w-[600px] mx-auto bg-white shadow-xl overflow-hidden relative">
      {renderTabContent()}
      <TabBar 
        currentTab={currentTab} 
        onTabSelect={handleTabSelect} 
        unreadTotal={totalUnread}
      />
    </div>
  );
};

export default App;