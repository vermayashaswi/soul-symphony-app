
import React, { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    onSendMessage(message);
    setMessage("");
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex items-end w-full">
        <div className="flex items-center w-full relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask anything..."
            className="min-h-[50px] md:min-h-[60px] text-sm md:text-base resize-none rounded-full pl-4 pr-16 py-3 shadow-sm border-muted bg-background"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {message.trim().length > 0 && (
            <Button 
              type="submit" 
              size={isMobile ? "sm" : "default"}
              className="rounded-full h-10 w-10 p-0 bg-primary text-primary-foreground"
              disabled={isLoading || !message.trim()}
            >
              <Send className="h-5 w-5" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
