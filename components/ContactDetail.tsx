import React from 'react';
import { ChevronLeft, MessageSquare, Video } from 'lucide-react';
import { User } from '../types';
import { COLORS, MOCK_MY_USER_ID } from '../constants';

interface ContactDetailProps {
  contact: User;
  onBack: () => void;
  onSendMessage: () => void;
}

export const ContactDetail: React.FC<ContactDetailProps> = ({ contact, onBack, onSendMessage }) => {
  const isMe = contact.id === MOCK_MY_USER_ID;

  return (
    <div className="flex flex-col h-full bg-[#ededed] animate-fade-in-up">
      {/* Navbar (Transparent absolute) */}
      <div className="absolute top-0 left-0 right-0 h-[44px] flex items-center px-3 z-30">
        <button onClick={onBack} className="p-1 -ml-2 text-white drop-shadow-md">
          <ChevronLeft size={28} />
        </button>
      </div>

      {/* Header with Blur BG */}
      <div className="relative h-[300px] w-full overflow-hidden shrink-0">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${contact.avatar})` }}
        />
        {/* Blur Overlay - Lightened for black text */}
        <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end">
          <div className="flex items-center">
            <img 
              src={contact.avatar} 
              className="w-[64px] h-[64px] rounded-[8px] border-2 border-white shadow-lg mr-4 object-cover"
              alt={contact.name}
            />
            {/* Changed to black text */}
            <div className="text-black drop-shadow-sm">
              <h1 className="text-2xl font-bold mb-1">{contact.name}</h1>
              <p className="text-sm opacity-90">ID: {contact.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="p-4 space-y-3 -mt-4 relative z-10 flex-1 overflow-y-auto no-scrollbar">
        <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
            <div className="flex justify-between border-b border-gray-100 pb-3">
                <span className="text-[#111] font-medium">Region</span>
                <span className="text-[#777]">{contact.region || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-[#111] font-medium">Status</span>
                <span className="text-[#777] italic">{contact.signature || 'No signature'}</span>
            </div>
        </div>

        {!isMe && (
          <div className="bg-white rounded-lg p-0 shadow-sm overflow-hidden">
             <button 
                onClick={onSendMessage}
                className="w-full py-4 flex items-center justify-center text-[#576b95] font-medium border-b border-gray-100 active:bg-gray-50"
             >
                <MessageSquare className="mr-2" size={20} />
                Send Message
             </button>
             <button className="w-full py-4 flex items-center justify-center text-[#111] font-medium active:bg-gray-50">
                <Video className="mr-2" size={20} />
                Video Call
             </button>
          </div>
        )}
      </div>
    </div>
  );
};