
import React, { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatSuggestionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  large?: boolean;
  first?: boolean;
}

// This component ensures that chat suggestion buttons have consistent classes for tutorial targeting
const ChatSuggestionButton = forwardRef<HTMLButtonElement, ChatSuggestionButtonProps>(
  ({ children, className, large, first, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn(
          "w-full text-left justify-start whitespace-normal h-auto py-2 px-3 text-sm border-muted shadow-sm",
          "hover:bg-primary/5 hover:text-primary focus-visible:ring-primary",
          "chat-suggestion-button",
          large && "text-base py-3 px-4",
          first && "first-suggestion",
          className
        )}
        data-tutorial-target="chat-suggestion"
        {...props}
      >
        {children}
      </Button>
    );
  }
);

ChatSuggestionButton.displayName = "ChatSuggestionButton";

export default ChatSuggestionButton;
