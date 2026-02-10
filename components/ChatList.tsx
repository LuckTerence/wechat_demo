import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChatSession, User } from '../types';
import { Loader2 } from 'lucide-react';

interface ChatListProps {
  sessions: ChatSession[];
  contacts: User[];
  onSelectSession: (sessionId: string) => void;
  refreshTrigger?: number;
}

// Optimization: Memoized List Item to prevent unnecessary re-renders
const ChatItem = React.memo(({ session, contact, onClick }: { session: ChatSession, contact: User, onClick: () => void }) => {
  const lastMsg = session.messages[session.messages.length - 1];
  if (!lastMsg) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  return (
    <div 
      onClick={onClick}
      className="flex items-center px-4 py-3 bg-white active:bg-[#d8d8d8] transition-colors border-b border-[#f0f0f0] cursor-pointer"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <img 
          src={contact.avatar} 
          alt={contact.name} 
          className="w-[48px] h-[48px] rounded-[6px] bg-gray-200 object-cover"
        />
        {session.unreadCount > 0 && (
          <div className="absolute -top-1.5 -right-1.5 bg-[#fa5151] text-white text-[10px] font-medium min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 border border-white">
            {session.unreadCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 ml-3 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[16px] font-medium text-[#111] truncate max-w-[70%]">
            {contact.name}
          </h3>
          <span className="text-[10px] text-[#b2b2b2]">
            {formatTime(lastMsg.timestamp)}
          </span>
        </div>
        <p className="text-[14px] text-[#999] truncate">
          {lastMsg.type === 'image' ? '[Image]' : lastMsg.content}
        </p>
      </div>
    </div>
  );
}, (prev, next) => {
  // Custom comparison for performance
  const prevMsg = prev.session.messages[prev.session.messages.length - 1];
  const nextMsg = next.session.messages[next.session.messages.length - 1];
  
  return (
    prev.session.unreadCount === next.session.unreadCount &&
    prevMsg?.id === nextMsg?.id &&
    prevMsg?.timestamp === nextMsg?.timestamp
  );
});

export const ChatList: React.FC<ChatListProps> = ({ sessions, contacts, onSelectSession, refreshTrigger = 0 }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);
  
  // Use a ref to track refreshing state to avoid dependency cycles in useCallback
  const isRefreshingRef = useRef(false);

  // Memoize helper to avoid recalculation on every render
  const getContact = useCallback((id: string) => contacts.find(c => c.id === id), [contacts]);

  const handlePullDown = useCallback(() => {
    // Check ref instead of state to avoid dependency changes
    if (isRefreshingRef.current) return;
    
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    
    // Simulate network request
    setTimeout(() => {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setShowRefreshToast(true);
      setTimeout(() => setShowRefreshToast(false), 2000);
    }, 1500);
  }, []); // Empty dependency array makes this function stable

  // Trigger refresh when refreshTrigger prop changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      handlePullDown();
    }
  }, [refreshTrigger, handlePullDown]);

  // Sort sessions by the timestamp of the last message (newest first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const msgA = a.messages[a.messages.length - 1];
      const msgB = b.messages[b.messages.length - 1];
      const timeA = msgA ? msgA.timestamp : 0;
      const timeB = msgB ? msgB.timestamp : 0;
      return timeB - timeA;
    });
  }, [sessions]);

  return (
    <div className="flex flex-col h-full bg-[#ededed]">
      {/* Header */}
      <div className="h-[44px] bg-[#ededed] flex items-center justify-center px-4 sticky top-0 z-20 border-b border-[#e5e5e5]/50 shrink-0">
        <span className="font-medium text-[17px] text-black">WeChat</span>
        <button 
          onClick={handlePullDown}
          className="absolute right-4 p-1 active:opacity-50"
        >
          {isRefreshing ? <Loader2 className="animate-spin w-4 h-4 text-gray-500"/> : <span className="text-xs text-gray-500">Sync</span>}
        </button>
      </div>

      {/* Refresh Toast */}
      {showRefreshToast && (
        <div className="fixed top-[60px] left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs py-1 px-3 rounded-full z-50 animate-fade-in-up transition-opacity">
          Syncing...
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-[60px]">
        {/* Pull Down Spinner (Visual) */}
        {isRefreshing && (
          <div className="w-full h-12 flex items-center justify-center bg-gray-50">
             <Loader2 className="animate-spin w-5 h-5 text-gray-400"/>
          </div>
        )}

        {sortedSessions.map(session => {
          const contact = getContact(session.userId);
          if (!contact) return null;

          return (
            <ChatItem 
              key={session.id} 
              session={session} 
              contact={contact} 
              onClick={() => onSelectSession(session.id)} 
            />
          );
        })}
      </div>
    </div>
  );
};