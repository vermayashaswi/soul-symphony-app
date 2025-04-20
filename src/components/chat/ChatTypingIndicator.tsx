
import React from 'react';

interface ChatTypingIndicatorProps {
  stage?: string;
}

const ChatTypingIndicator: React.FC<ChatTypingIndicatorProps> = ({ stage }) => {
  return (
    <div className="flex space-x-1 items-center">
      <div className="h-3 w-3 rounded-full bg-gray-400 animate-pulse" />
      <div className="h-3 w-3 rounded-full bg-gray-600 animate-pulse animation-delay-150" />
      <div className="h-3 w-3 rounded-full bg-gray-800 animate-pulse animation-delay-300" />
      {stage && <span className="ml-2 text-xs text-muted-foreground">{stage}</span>}
    </div>
  );
};

export default ChatTypingIndicator;
