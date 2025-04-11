
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { Input } from "@/components/ui/input";

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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatDebug = useDebugLog();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.8;
        setIsKeyboardVisible(isKeyboard);
        
        // Dispatch custom event to notify other components
        const eventName = isKeyboard ? 'keyboardOpen' : 'keyboardClose';
        window.dispatchEvent(new Event(eventName));
        
        // If keyboard is visible, ensure input is visible
        if (isKeyboard && inputRef.current) {
          // Delay scrolling to ensure UI has updated
          setTimeout(() => {
            // Scroll to make input visible
            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            // Also scroll the page to ensure the input is visible
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: 'smooth'
            });
          }, 300);
        }
      }
    };

    // Initial check
    handleVisualViewportResize();
    
    // Set up listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.addEventListener('resize', handleVisualViewportResize);
    }
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);

  // Handle focus events
  useEffect(() => {
    const handleFocus = () => {
      // Scroll to the input field when it receives focus
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
        
        // Set keyboard visible state to ensure proper positioning
        setIsKeyboardVisible(true);
        
        // Dispatch custom event
        window.dispatchEvent(new Event('keyboardOpen'));
      }, 300);
    };

    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener('focus', handleFocus);
    }

    return () => {
      if (inputElement) {
        inputElement.removeEventListener('focus', handleFocus);
      }
    };
  }, []);

  return (
    <div 
      className={`p-2 bg-background border-t border-border flex items-center gap-2 ${
        isKeyboardVisible ? 'fixed bottom-0 left-0 right-0 z-[9999] input-keyboard-active' : ''
      }`}
      style={{
        paddingBottom: isKeyboardVisible ? '10px' : 'env(safe-area-inset-bottom, 10px)'
      }}
    >
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          className="w-full pr-10 focus:outline-none focus:ring-1 focus:ring-primary bg-background"
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
