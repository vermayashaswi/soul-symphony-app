
import React from 'react';
import ChatSuggestionButton from './ChatSuggestionButton';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { ChartBar, Lightbulb, Search, Flower } from 'lucide-react';

interface EmptyChatStateProps {
  onSuggestionClick?: (suggestion: string) => void;
}

const EmptyChatState: React.FC<EmptyChatStateProps> = ({ onSuggestionClick }) => {
  const suggestions = [
    {
      text: "What were my top emotions last week?",
      icon: ChartBar
    },
    {
      text: "What time of the day do I usually like journaling?",
      icon: Search
    },
    {
      text: "Am I an introvert? Do I like people in general?",
      icon: Lightbulb
    },
    {
      text: "What should I particularly do to help my mental health?",
      icon: Flower
    }
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
        {suggestions.map((suggestion, index) => {
          const IconComponent = suggestion.icon;
          return (
            <ChatSuggestionButton
              key={index}
              onClick={() => onSuggestionClick?.(suggestion.text)}
            >
              <div className="flex items-center gap-2">
                <IconComponent className="h-4 w-4 text-muted-foreground" />
                <span>{suggestion.text}</span>
              </div>
            </ChatSuggestionButton>
          );
        })}
      </div>
    </div>
  );
};

export default EmptyChatState;
