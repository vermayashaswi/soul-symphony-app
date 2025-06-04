
import React from 'react';
import { Bot } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import ChatSuggestionButton from './ChatSuggestionButton';

interface ChatWelcomeSectionProps {
  onSuggestionClick: (suggestion: string) => void;
}

const ChatWelcomeSection: React.FC<ChatWelcomeSectionProps> = ({ onSuggestionClick }) => {
  const suggestions = [
    "How was my mood this week?",
    "What patterns do you see in my journal entries?", 
    "Help me reflect on my recent experiences",
    "What insights can you share about my emotional journey?"
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="mb-8">
        <Bot className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          <TranslatableText text="Welcome to SOULo" />
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          <TranslatableText text="Your AI companion for journal insights and emotional wellbeing. Ask me anything about your entries!" />
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((suggestion, index) => (
          <ChatSuggestionButton
            key={index}
            suggestion={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
          />
        ))}
      </div>
    </div>
  );
};

export default ChatWelcomeSection;
