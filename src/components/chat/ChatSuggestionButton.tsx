
import React from 'react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ChatSuggestionButtonProps {
  suggestion: string;
  onClick: () => void;
}

const ChatSuggestionButton: React.FC<ChatSuggestionButtonProps> = ({ suggestion, onClick }) => {
  return (
    <Button
      variant="outline"
      className="p-4 h-auto text-left justify-start whitespace-normal border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 chat-suggestion-button"
      onClick={onClick}
    >
      <TranslatableText text={suggestion} className="text-sm" />
    </Button>
  );
};

export default ChatSuggestionButton;
