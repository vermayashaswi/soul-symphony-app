
import React, { useState, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
  userId
}) => {
  const [message, setMessage] = useState("");
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    onSendMessage(message);
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight(e.target);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center w-full">
        <div className="flex items-center w-full relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            placeholder="Type your message..."
            className="min-h-[24px] h-[32px] text-sm md:text-base resize-none rounded-full pl-4 pr-12 py-0 shadow-sm border-muted bg-background overflow-hidden"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            onFocus={() => {
              // Only for mobile, ensure the textarea is visible when focused
              if (isMobile) {
                setTimeout(() => {
                  window.scrollTo({
                    top: document.body.scrollHeight,
                    behavior: 'smooth'
                  });
                  textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 300);
              }
            }}
          />
        </div>
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
          <Button 
            type="submit" 
            size={isMobile ? "sm" : "default"}
            className="rounded-full h-7 w-7 p-0 bg-primary text-primary-foreground"
            disabled={isLoading}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
