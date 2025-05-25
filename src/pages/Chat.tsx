
import React from 'react';
import { SmartChatInterface } from '@/components/chat/SmartChatInterface';
import { FeatureGuard } from '@/components/subscription/FeatureGuard';

const Chat = () => {
  return (
    <FeatureGuard feature="chat">
      <div className="h-screen flex flex-col">
        <SmartChatInterface />
      </div>
    </FeatureGuard>
  );
};

export default Chat;
