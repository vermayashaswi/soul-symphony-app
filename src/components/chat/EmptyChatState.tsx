
import React from 'react';
import ChatSuggestionButton from './ChatSuggestionButton';
import { useTranslation } from '@/contexts/TranslationContext';

const EmptyChatState: React.FC = () => {
  const { translate } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center empty-chat-state">
      <div className="space-y-2 mb-8">
        <h3 className="text-xl font-semibold">
          {translate ? translate("Ask about your journal entries", "en") : "Ask about your journal entries"}
        </h3>
        <p className="text-muted-foreground text-sm">
          {translate ? translate("Get insights from your journal by asking questions", "en") : "Get insights from your journal by asking questions"}
        </p>
      </div>
      
      <div className="grid gap-3 w-full max-w-sm empty-chat-suggestion">
        <ChatSuggestionButton text="How did I feel last week?" />
        <ChatSuggestionButton text="What topics have I been writing about recently?" />
        <ChatSuggestionButton text="When do I usually feel most inspired?" />
        <ChatSuggestionButton text="What are my most common emotions?" />
      </div>
    </div>
  );
};

export default EmptyChatState;
