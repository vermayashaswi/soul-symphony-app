
import React from 'react';
import { ChatMessage } from '@/services/chat/types';

interface ChatMessageItemProps {
  message: ChatMessage;
  isLastMessage: boolean;
  threadId: string | null;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, isLastMessage }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

export default ChatMessageItem;
