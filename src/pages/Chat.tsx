
import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import Navbar from '@/components/Navbar';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import MobileChatInterface from '@/components/chat/mobile/MobileChatInterface';
import JournalDebugPanel from '@/components/journal/JournalDebugPanel';

const Chat = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const chatRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col min-h-screen bg-background" ref={chatRef}>
      <Navbar />
      
      <div className="container mx-auto flex-1 p-4 pt-0 flex flex-col">
        {isMobile ? (
          <MobileChatInterface />
        ) : (
          <SmartChatInterface />
        )}
      </div>
      
      {/* Add debug panel */}
      <JournalDebugPanel />
    </div>
  );
};

export default Chat;
