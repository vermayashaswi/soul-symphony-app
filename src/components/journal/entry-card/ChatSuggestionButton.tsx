
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatSuggestionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export const ChatSuggestionButton = ({
  children,
  onClick,
  className
}: ChatSuggestionButtonProps) => {
  return (
    <Button
      variant="secondary" 
      onClick={onClick}
      className={cn(
        "chat-suggestion-button text-sm px-3 py-1 h-auto", 
        className
      )}
      data-tutorial-target="chat-suggestion"
    >
      {children}
    </Button>
  );
};

export default ChatSuggestionButton;
