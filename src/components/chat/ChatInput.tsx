
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Lightbulb } from "lucide-react";
import QuerySuggestions from "./QuerySuggestions";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
  isPlannerMode?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
  userId,
  isPlannerMode = false
}) => {
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update textarea height on input
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200); // Max height of 200px
      textarea.style.height = `${newHeight}px`;
    }
  }, [message]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage("");
      setShowSuggestions(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
  };
  
  return (
    <div className="relative">
      {showSuggestions && userId && (
        <QuerySuggestions 
          onSuggestionClick={handleSuggestionClick} 
          onClose={() => setShowSuggestions(false)}
        />
      )}
      
      <form onSubmit={handleSubmit} className="relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isPlannerMode 
            ? "Ask a complex question (planner mode)..." 
            : "Type a message..."}
          className={`pr-24 min-h-[50px] max-h-[200px] resize-none
            ${isPlannerMode ? 'border-primary bg-primary/5' : ''}`}
          disabled={isLoading}
        />
        
        <div className="absolute right-2 bottom-2 flex space-x-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowSuggestions(true)}
            disabled={isLoading}
            className="h-8 w-8"
            title="Query suggestions"
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
          
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !message.trim()}
            className={`h-8 w-8 ${isPlannerMode ? 'bg-primary/90 hover:bg-primary' : ''}`}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
