
import React from 'react';
import ChatSuggestionButton from './ChatSuggestionButton';
import { TranslatableText } from '@/components/translation/TranslatableText';

const EmptyChatState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center empty-chat-state">
      <div className="space-y-2 mb-8">
        <h3 className="text-xl font-semibold">
          <TranslatableText text="How can I help you?" />
        </h3>
        <p className="text-muted-foreground text-sm">
          <TranslatableText text="Ask me anything about your mental well-being and journal entries" />
        </p>
      </div>
      
      <div className="grid gap-3 w-full max-w-sm empty-chat-suggestion">
        <ChatSuggestionButton>How have I been feeling lately?</ChatSuggestionButton>
        <ChatSuggestionButton>What patterns do you see in my journal?</ChatSuggestionButton>
        <ChatSuggestionButton>Can you help me reflect on my recent entries?</ChatSuggestionButton>
        <ChatSuggestionButton>What insights can you share about my mood?</ChatSuggestionButton>
      </div>
    </div>
  );
};

export default EmptyChatState;
