
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

  return (
    <div className="p-3 bg-background border-t border-border flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          className="w-full border rounded-lg py-2 px-3 pr-10 focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-[24px] max-h-[36px] bg-background overflow-hidden"
          disabled={isLoading || isSubmitting}
        />
      </div>
      
      <div className="flex-shrink-0">
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={handleSendMessage}
          disabled={isLoading || isSubmitting || !inputValue.trim()}
        >
          {isSubmitting || isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
