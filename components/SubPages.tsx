import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface SubPageProps {
  type: 'settings' | 'general';
  onBack: () => void;
}

export const SubPage: React.FC<SubPageProps> = ({ type, onBack }) => {
  const title = type === 'settings' ? 'Settings' : 'General';
  const items = type === 'settings' 
    ? ['Notifications', 'Privacy', 'Security', 'Help & Feedback', 'About']
    : ['Language', 'Storage', 'Appearance', 'Photos, Videos, Files', 'Accessibility'];

  return (
    <div className="flex flex-col h-full bg-[#ededed] relative z-50 animate-fade-in-up">
      {/* Header */}
      <div className="h-[44px] bg-[#ededed] flex items-center justify-between px-3 border-b border-[#e5e5e5]/50 shrink-0">
        <button onClick={onBack} className="p-1 -ml-2 flex items-center text-black">
          <ChevronLeft size={24} />
          <span className="text-[16px]">Back</span>
        </button>
        <span className="font-medium text-[17px] text-black">{title}</span>
        <div className="w-[32px]"></div>
      </div>

      {/* Menu Items */}
      <div className="mt-3 bg-white border-y border-[#e5e5e5]">
        {items.map((item, idx) => (
           <div 
             key={idx} 
             className={`p-4 flex justify-between items-center active:bg-gray-100 cursor-pointer
               ${idx !== items.length - 1 ? 'border-b border-[#e5e5e5] ml-4' : 'ml-4'}
             `}
           >
              <span className="text-black text-[16px]">{item}</span>
              <ChevronLeft className="rotate-180 text-gray-300 mr-4" size={20} />
           </div>
        ))}
      </div>
    </div>
  );
};