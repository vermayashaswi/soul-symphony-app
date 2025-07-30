import React, { createContext, useContext, ReactNode } from 'react';
import { usePageTranslation } from '@/hooks/use-page-translation';

interface ChatTranslationContextType {
  isTranslating: boolean;
  progress: number;
  getTranslation: (text: string) => string | null;
  retryTranslation: () => void;
}

const ChatTranslationContext = createContext<ChatTranslationContextType | undefined>(undefined);

interface ChatTranslationProviderProps {
  children: ReactNode;
}

// Common texts used throughout the Chat page
const CHAT_PAGE_TEXTS = [
  'Chat',
  'AI Companion',
  'Type your message...',
  'Send',
  'Voice message',
  'Start voice message',
  'Stop recording',
  'Send voice message',
  'Clear chat',
  'New conversation',
  'Chat history',
  'You',
  'AI',
  'Thinking...',
  'Processing your message...',
  'Failed to send message',
  'Retry',
  'Message sent',
  'Connection lost',
  'Reconnecting...',
  'Connected',
  'Copy message',
  'Delete message',
  'Regenerate response',
  'Export chat',
  'Clear all messages',
  'Are you sure?',
  'This action cannot be undone',
  'Cancel',
  'Confirm',
  'Smart Chat',
  'Enhanced AI features',
  'Voice chat',
  'Text chat',
  'Mixed mode',
  'Conversation starter',
  'How can I help you today?',
  'Let\'s explore your thoughts',
  'Tell me about your day',
  'What\'s on your mind?',
  'I\'m here to listen',
  'Share your feelings',
  'Ask me anything',
  'Start chatting',
  'No messages yet',
  'Begin a conversation',
  'Conversation saved',
  'Message copied',
  'Message deleted',
  'Response regenerated'
];

export const ChatTranslationProvider: React.FC<ChatTranslationProviderProps> = ({ children }) => {
  const pageTranslation = usePageTranslation({
    pageTexts: CHAT_PAGE_TEXTS,
    route: '/chat',
    enabled: true
  });

  const value: ChatTranslationContextType = {
    isTranslating: pageTranslation.isTranslating,
    progress: pageTranslation.progress,
    getTranslation: pageTranslation.getTranslation,
    retryTranslation: pageTranslation.retryTranslation
  };

  return (
    <ChatTranslationContext.Provider value={value}>
      {children}
    </ChatTranslationContext.Provider>
  );
};

export const useChatTranslation = (): ChatTranslationContextType => {
  const context = useContext(ChatTranslationContext);
  if (context === undefined) {
    throw new Error('useChatTranslation must be used within a ChatTranslationProvider');
  }
  return context;
};