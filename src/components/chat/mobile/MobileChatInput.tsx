
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useDebugLog } from "@/utils/debug/DebugContext";

interface MobileChatInputProps {
  onSendMessage: (message: string, isAudio?: boolean) => void;
  isLoading: boolean;
  userId?: string;
}

export default function MobileChatInput({
  onSendMessage,
  isLoading,
  userId
}: MobileChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatDebug = useDebugLog();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight(e.target);
  };

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 36)}px`;
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (isLoading || isSubmitting) return;

    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      try {
        chatDebug.addEvent("User Message", `Preparing to send: "${trimmedValue.substring(0, 30)}${trimmedValue.length > 30 ? '...' : ''}"`, "info");
        setIsSubmitting(true);
        
        chatDebug.addEvent("Send Message", "Calling onSendMessage handler", "info");
        onSendMessage(trimmedValue);
        
        setInputValue("");
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.focus();
        }
        
        chatDebug.addEvent("User Input", "Reset input field after sending", "success");
      } catch (error) {
        console.error("Error sending message:", error);
        chatDebug.addEvent("Send Error", error instanceof Error ? error.message : "Unknown error sending message", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Track keyboard visibility
  useEffect(() => {
    const handleResize = () => {
      // Simple heuristic for detecting keyboard on mobile
      const visualViewport = window.visualViewport;
      if (visualViewport) {
        const isKeyboard = visualViewport.height < window.innerHeight * 0.8;
        setIsKeyboardOpen(isKeyboard);
      }
    };

    // Use VisualViewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }
    
    return undefined;
  }, []);

  return (
    <div className={`p-2 bg-background border-t border-border flex items-center gap-2 ${isKeyboardOpen ? 'keyboard-visible' : ''}`}>
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onFocus={() => setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100)}
          placeholder="Type your message..."
          className="w-full border rounded-lg py-1 px-3 pr-10 focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-[24px] max-h-[36px] bg-background overflow-hidden"
          disabled={isLoading || isSubmitting}
        />
      </div>
      
      <div className="flex-shrink-0 flex items-center">
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 rounded-full flex items-center justify-center"
          onClick={handleSendMessage}
          disabled={isLoading || isSubmitting || !inputValue.trim()}
        >
          {isSubmitting || isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
