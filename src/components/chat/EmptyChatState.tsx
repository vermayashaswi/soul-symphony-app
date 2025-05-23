
import React from 'react';
import ChatSuggestionButton from './ChatSuggestionButton';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EmptyChatStateProps {
  onSuggestionClick?: (suggestion: string) => void;
}

const EmptyChatState: React.FC<EmptyChatStateProps> = ({ onSuggestionClick }) => {
  const suggestions = [
    "How have I been feeling lately?",
    "What patterns do you see in my journal?",
    "Can you help me reflect on my recent entries?",
    "What insights can you share about my mood?"
  ];

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
        {suggestions.map((suggestion, index) => (
          <ChatSuggestionButton
            key={index}
            onClick={() => onSuggestionClick?.(suggestion)}
          >
            {suggestion}
          </ChatSuggestionButton>
        ))}
      </div>
    </div>
  );
};

export default EmptyChatState;
