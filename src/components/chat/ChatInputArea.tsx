
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface ChatInputAreaProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isProcessing: boolean;
  placeholder?: string;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  onSendMessage,
  isLoading,
  isProcessing,
  placeholder = "Ask me about your journal entries or mental health..."
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isLoading || isProcessing) return;
    
    const messageText = inputMessage.trim();
    setInputMessage('');
    onSendMessage(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t border-border p-4 bg-background">
      <div className="flex gap-2 max-w-4xl mx-auto">
        <Textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="min-h-[60px] resize-none flex-1"
          disabled={isLoading || isProcessing}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isLoading || isProcessing}
          size="lg"
          className="px-6"
        >
          {isLoading || isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="mt-2 text-xs text-muted-foreground text-center max-w-4xl mx-auto">
        <TranslatableText text="SOULo uses your journal entries to provide personalized insights" />
      </div>
    </div>
  );
};

export default ChatInputArea;
