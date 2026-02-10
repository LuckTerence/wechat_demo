import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, PlusCircle, Mic, Smile, Keyboard, Image as ImageIcon, Camera, MapPin, Video, User as UserIcon, Loader2 } from 'lucide-react';
import { ChatSession, User } from '../types';
import { COLORS, MOCK_MY_USER_ID } from '../constants';

interface ChatDetailProps {
  session: ChatSession;
  contact: User;
  currentUser: User;
  onBack: () => void;
  onSendMessage: (sessionId: string, content: string, type: 'text' | 'image') => void;
  onViewProfile: (userId: string) => void;
}

const EMOJIS = ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲'];

export const ChatDetail: React.FC<ChatDetailProps> = ({ 
  session, 
  contact, 
  currentUser,
  onBack, 
  onSendMessage,
  onViewProfile
}) => {
  const [inputValue, setInputValue] = useState('');
  const [panelOpen, setPanelOpen] = useState<'none' | 'emoji' | 'more'>('none');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState(''); // Text being transcribed in real-time
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Pull to refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartRef = useRef(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef(''); // Ref to hold transcript without triggering re-renders inside event loops

  // File Inputs Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (!isRefreshing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages, panelOpen, inputMode, voiceText]); // Added voiceText to scroll as you speak

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    onSendMessage(session.id, inputValue, 'text');
    setInputValue('');
  }, [inputValue, session.id, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // --- Image / Camera Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onSendMessage(session.id, event.target.result as string, 'image');
          setPanelOpen('none');
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const triggerPhoto = () => fileInputRef.current?.click();
  const triggerCamera = () => cameraInputRef.current?.click();

  const insertEmoji = (emoji: string) => {
    setInputValue(prev => prev + emoji);
  };

  const toggleVoiceMode = () => {
    setInputMode(prev => prev === 'text' ? 'voice' : 'text');
    setPanelOpen('none');
  };

  const togglePanel = (panel: 'emoji' | 'more') => {
    if (panelOpen === panel) {
      setPanelOpen('none');
      if (inputMode === 'text') setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setPanelOpen(panel);
      setInputMode('text'); 
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  const handleInputFocus = () => {
    setPanelOpen('none');
  };

  // --- Touch Handlers for Pull-to-Refresh ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 1) {
      touchStartRef.current = e.touches[0].clientY;
    } else {
      touchStartRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === 0 || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    
    if (diff > 0 && scrollRef.current?.scrollTop === 0) {
      setPullDistance(Math.min(diff * 0.4, 100));
    }
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === 0) return;

    if (pullDistance > 50) {
      setIsRefreshing(true);
      setPullDistance(50);
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1500);
    } else {
      setPullDistance(0);
    }
    touchStartRef.current = 0;
  };

  // --- Voice to Text: Hold to Speak, Release to Send ---

  const startRecording = (e: React.SyntheticEvent) => {
    e.preventDefault(); // Prevent text selection/native behavior
    setIsRecording(true);
    setVoiceText('');
    transcriptRef.current = '';

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US'; 
      recognition.continuous = true; 
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // Update visual feedback
        const currentText = finalTranscript || interimTranscript;
        setVoiceText(currentText);
        
        // Update ref for sending later
        if (finalTranscript) {
             // In continuous mode, we might get multiple finals. We append or just take the latest flow.
             // For this simple implementation, we just track the active flow.
             transcriptRef.current = finalTranscript;
        } else {
             transcriptRef.current = interimTranscript;
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event);
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } else {
      alert("Speech Recognition API not supported.");
      setIsRecording(false);
    }
  };

  const stopRecordingAndSend = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!isRecording) return;

    setIsRecording(false);
    setVoiceText(''); // Clear overlay

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Send the captured text
    const textToSend = transcriptRef.current;
    if (textToSend && textToSend.trim().length > 0) {
        onSendMessage(session.id, textToSend.trim(), 'text');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#ededed] relative">
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={cameraInputRef} 
        onChange={handleFileChange} 
      />

      {/* Voice Recording Overlay (Toast) */}
      {isRecording && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg p-6 w-[160px] h-[160px] flex flex-col items-center justify-center text-white">
            <Mic size={48} className="animate-pulse mb-4 text-[#07c160]" />
            <span className="font-medium text-sm">Release to Send</span>
          </div>
          {/* Real-time transcription preview bubble */}
          {voiceText && (
             <div className="mt-4 bg-[#95ec69] text-black px-4 py-2 rounded-lg max-w-[80%] shadow-lg">
                {voiceText}
             </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="h-[44px] bg-[#ededed] flex items-center justify-between px-3 border-b border-[#e5e5e5]/50 shrink-0 z-20">
        <button onClick={onBack} className="p-1 -ml-2 flex items-center text-black">
          <ChevronLeft size={24} />
          <span className="text-[16px] text-black">WeChat</span>
        </button>
        <span className="font-medium text-[17px] text-black">{contact.name}</span>
        <div className="w-[32px]"></div>
      </div>

      {/* Messages Area with Pull-to-Refresh */}
      <div 
        className="flex-1 overflow-y-auto px-3 py-0 space-y-4 no-scrollbar scroll-smooth transition-all duration-300 relative"
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Loading Indicator */}
        <div 
            style={{ height: pullDistance, opacity: pullDistance > 0 ? 1 : 0 }} 
            className="flex items-end justify-center overflow-hidden transition-all duration-200"
        >
            <div className="pb-2 flex items-center gap-2 text-gray-500 text-xs">
                {isRefreshing && <Loader2 className="animate-spin w-4 h-4"/>}
                <span>{isRefreshing ? "Syncing..." : "Pull to refresh"}</span>
            </div>
        </div>

        {/* Padding for first message */}
        <div className="h-4"></div>

        {session.messages.map((msg) => {
          const isMe = msg.senderId === MOCK_MY_USER_ID;
          const sender = isMe ? currentUser : contact;

          return (
            <div 
              key={msg.id} 
              id={msg.id}
              className={`flex w-full mb-4 animate-fade-in-up ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <img 
                src={sender.avatar} 
                className="w-[40px] h-[40px] rounded-[4px] bg-gray-300 object-cover shrink-0 cursor-pointer" 
                alt="Avatar"
                onClick={() => onViewProfile(sender.id)}
              />

              <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end mr-3' : 'items-start ml-3'}`}>
                <div 
                  className={`
                    px-3 py-2.5 rounded-[4px] relative text-[15px] leading-[1.4] break-words shadow-sm
                    ${isMe 
                      ? `bg-[#95ec69] text-[#000000]` 
                      : `bg-white text-[#000000]`
                    }
                  `}
                >
                  <div 
                    className={`absolute top-[12px] w-0 h-0 border-y-[6px] border-y-transparent 
                    ${isMe 
                      ? `right-[-6px] border-l-[6px] border-l-[#95ec69]` 
                      : `left-[-6px] border-r-[6px] border-r-white`
                    }`}
                  />

                  {msg.type === 'text' ? (
                    <span className="text-[#000000]">{msg.content}</span>
                  ) : (
                    <img 
                      src={msg.content} 
                      onClick={() => setPreviewImage(msg.content)}
                      className="rounded-[4px] max-w-full max-h-[150px] object-cover cursor-pointer"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="bg-[#f7f7f7] border-t border-[#e5e5e5] px-2 py-2 flex items-end gap-2 shrink-0 z-20">
        <button 
          className="p-2 text-[#111]" 
          onClick={toggleVoiceMode}
        >
          {inputMode === 'text' ? <Mic size={26} strokeWidth={1} /> : <Keyboard size={26} strokeWidth={1} />}
        </button>
        
        <div className="flex-1 min-h-[40px] my-1 flex items-center justify-center">
           {inputMode === 'text' ? (
              <input 
                ref={inputRef}
                type="text" 
                className="w-full h-full min-h-[40px] px-2 bg-white rounded-[4px] border-none outline-none text-[16px] text-[#000000]"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={handleKeyDown}
              />
           ) : (
             <button 
               className={`w-full h-[40px] rounded-[4px] font-medium text-[16px] select-none transition-colors
                 ${isRecording ? 'bg-[#c6c6c6] text-[#555]' : 'bg-white text-[#111]'}
               `}
               onMouseDown={startRecording}
               onMouseUp={stopRecordingAndSend}
               onTouchStart={startRecording}
               onTouchEnd={stopRecordingAndSend}
             >
               {isRecording ? 'Release to Send' : 'Hold to Talk'}
             </button>
           )}
        </div>

        <button 
          className="p-2 text-[#111]"
          onClick={() => togglePanel('emoji')}
        >
          <Smile size={26} strokeWidth={1} fill={panelOpen === 'emoji' ? '#ddd' : 'none'}/>
        </button>
        
        {inputValue ? (
           <button 
             onClick={handleSend}
             className="h-[32px] px-4 my-1.5 bg-[#07c160] text-white rounded-[4px] text-sm font-medium flex items-center"
           >
             Send
           </button>
        ) : (
           <button 
            onClick={() => togglePanel('more')}
            className="p-2 text-[#111]"
           >
             <PlusCircle size={26} strokeWidth={1} transform={panelOpen === 'more' ? 'rotate(45)' : ''} className="transition-transform duration-200" />
           </button>
        )}
      </div>

      {/* Panels (Emoji / More) */}
      <div 
        className="bg-[#f7f7f7] overflow-hidden transition-all duration-300 ease-out border-t border-[#e5e5e5]"
        style={{ height: panelOpen !== 'none' ? 280 : 0 }}
      >
        {/* Emoji Panel */}
        {panelOpen === 'emoji' && (
          <div className="h-full overflow-y-auto p-4 grid grid-cols-8 gap-4 content-start">
             {EMOJIS.map(e => (
               <button 
                 key={e} 
                 className="text-2xl hover:bg-gray-200 rounded p-1"
                 onClick={() => insertEmoji(e)}
               >
                 {e}
               </button>
             ))}
          </div>
        )}

        {/* More Actions Panel */}
        {panelOpen === 'more' && (
           <div className="h-full p-6 grid grid-cols-4 gap-y-6">
              <ActionButton icon={<ImageIcon size={28}/>} label="Photos" onClick={triggerPhoto} />
              <ActionButton icon={<Camera size={28}/>} label="Camera" onClick={triggerCamera} />
              <ActionButton icon={<Video size={28}/>} label="Video Call" />
              <ActionButton icon={<MapPin size={28}/>} label="Location" />
              <ActionButton icon={<UserIcon size={28}/>} label="Card" />
              <ActionButton icon={<div className="font-bold text-lg">¥</div>} label="Red Packet" />
           </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black z-50 flex items-center justify-center animate-fade-in-up"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} className="max-w-full max-h-full" alt="Preview" />
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
  <div className="flex flex-col items-center gap-2 cursor-pointer active:opacity-70" onClick={onClick}>
     <div className="w-[60px] h-[60px] bg-white rounded-[16px] flex items-center justify-center text-[#555] border border-gray-200">
        {icon}
     </div>
     <span className="text-[12px] text-[#888]">{label}</span>
  </div>
);