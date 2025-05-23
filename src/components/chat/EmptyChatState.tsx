
import React from 'react';
import ChatSuggestionButton from './ChatSuggestionButton';
import { TranslatableText } from '@/components/translation/TranslatableText';

const EmptyChatState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center empty-chat-state">
      <div className="space-y-2 mb-8">
        <h3 className="text-xl font-semibold">
          <TranslatableText text="Ask about your journal entries" />
        </h3>
        <p className="text-muted-foreground text-sm">
          <TranslatableText text="Get insights from your journal by asking questions" />
        </p>
      </div>
      
      <div className="grid gap-3 w-full max-w-sm empty-chat-suggestion">
        <ChatSuggestionButton>How did I feel last week?</ChatSuggestionButton>
        <ChatSuggestionButton>What topics have I been writing about recently?</ChatSuggestionButton>
        <ChatSuggestionButton>When do I usually feel most inspired?</ChatSuggestionButton>
        <ChatSuggestionButton>What are my most common emotions?</ChatSuggestionButton>
      </div>
    </div>
  );
};

export default EmptyChatState;
