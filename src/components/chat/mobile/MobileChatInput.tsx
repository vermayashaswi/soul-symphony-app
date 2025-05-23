
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface MobileChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
}

export default function MobileChatInput({ onSendMessage, isLoading, userId }: MobileChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && userId) {
      console.log("[MobileChatInput] Sending message:", message.trim());
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } else if (!userId) {
      console.warn("[MobileChatInput] No user ID provided, cannot send message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading || !userId}
            className="min-h-[44px] max-h-[120px] resize-none border-2 focus:border-primary"
            rows={1}
          />
        </div>
        <Button 
          type="submit" 
          size="icon"
          disabled={!message.trim() || isLoading || !userId}
          className="h-11 w-11 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
      {isLoading && (
        <div className="mt-2 text-sm text-muted-foreground flex items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin mr-2" />
          <TranslatableText text="Processing your message..." />
        </div>
      )}
    </div>
  );
}
