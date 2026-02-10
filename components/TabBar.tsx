import React from 'react';
import { MessageSquare, Contact, User } from 'lucide-react';
import { Tab } from '../types';
import { COLORS } from '../constants';

interface TabBarProps {
  currentTab: Tab;
  onTabSelect: (tab: Tab) => void;
  unreadTotal: number;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabSelect, unreadTotal }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[56px] bg-[#f7f7f7] border-t border-[#e5e5e5] flex items-center justify-around z-50 pb-safe">
      <button 
        onClick={() => onTabSelect('chat')}
        className="flex flex-col items-center justify-center w-full h-full relative active:bg-gray-100"
      >
        <div className="relative">
          <MessageSquare 
            size={24} 
            fill={currentTab === 'chat' ? COLORS.primary : 'none'} 
            color={currentTab === 'chat' ? COLORS.primary : '#111'} 
            strokeWidth={currentTab === 'chat' ? 0 : 1.5}
          />
          {unreadTotal > 0 && (
            <span className="absolute -top-1 -right-2 bg-[#fa5151] text-white text-[10px] font-bold px-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center">
              {unreadTotal}
            </span>
          )}
        </div>
        <span className={`text-[10px] mt-0.5 ${currentTab === 'chat' ? 'text-[#07c160]' : 'text-[#111]'}`}>Chats</span>
      </button>

      <button 
        onClick={() => onTabSelect('contact')}
        className="flex flex-col items-center justify-center w-full h-full active:bg-gray-100"
      >
        <Contact 
            size={24} 
            fill={currentTab === 'contact' ? COLORS.primary : 'none'} 
            color={currentTab === 'contact' ? COLORS.primary : '#111'} 
            strokeWidth={currentTab === 'contact' ? 0 : 1.5}
        />
        <span className={`text-[10px] mt-0.5 ${currentTab === 'contact' ? 'text-[#07c160]' : 'text-[#111]'}`}>Contacts</span>
      </button>

      <button 
        onClick={() => onTabSelect('profile')}
        className="flex flex-col items-center justify-center w-full h-full active:bg-gray-100"
      >
         <User 
            size={24} 
            fill={currentTab === 'profile' ? COLORS.primary : 'none'} 
            color={currentTab === 'profile' ? COLORS.primary : '#111'} 
            strokeWidth={currentTab === 'profile' ? 0 : 1.5}
         />
        <span className={`text-[10px] mt-0.5 ${currentTab === 'profile' ? 'text-[#07c160]' : 'text-[#111]'}`}>Me</span>
      </button>
    </div>
  );
};