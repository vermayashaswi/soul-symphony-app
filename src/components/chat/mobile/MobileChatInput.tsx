
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
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const chatDebug = useDebugLog();

  // Effect to ensure input stays visible
  useEffect(() => {
    const ensureInputVisibility = () => {
      if (inputContainerRef.current) {
        inputContainerRef.current.style.visibility = 'visible';
        inputContainerRef.current.style.opacity = '1';
        inputContainerRef.current.style.display = 'block';
      }
    };
    
    // Run immediately
    ensureInputVisibility();
    
    // And set an interval to check periodically (more frequently)
    const visibilityInterval = setInterval(ensureInputVisibility, 250);
    
    return () => {
      clearInterval(visibilityInterval);
    };
  }, [isLoading, isSubmitting]);

  // Focus input when loading completes
  useEffect(() => {
    if (!isLoading && !isSubmitting && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isLoading, isSubmitting]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
      
      // Close keyboard
      inputRef.current?.blur();
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
          inputRef.current.blur(); // Close keyboard after sending
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

  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.8;
        setIsKeyboardVisible(isKeyboard);
        
        const eventName = isKeyboard ? 'keyboardOpen' : 'keyboardClose';
        window.dispatchEvent(new Event(eventName));
        
        if (isKeyboard && inputRef.current) {
          // Ensure the chat input is visible by scrolling to it
          setTimeout(() => {
            // More aggressive scrolling - ensure we see the input box clearly
            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: 'smooth'
            });
          }, 300);
        }
      }
    };

    handleVisualViewportResize();
    
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

  useEffect(() => {
    const handleFocus = () => {
      setTimeout(() => {
        // More aggressive scrolling and positioning for focus events
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
        
        setIsKeyboardVisible(true);
        
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
      ref={inputContainerRef}
      className={`p-2 bg-background border-t border-border flex items-center gap-2 ${
        isKeyboardVisible ? 'fixed bottom-0 left-0 right-0 z-[9999] input-keyboard-active' : ''
      }`}
      style={{
        paddingBottom: isKeyboardVisible ? '7px' : 'env(safe-area-inset-bottom, 10px)',
        marginBottom: 0, // Keep consistent margin
        // Add a clear visual separation from the navbar with a slight shadow
        boxShadow: '0 -2px 5px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        zIndex: 50, // Ensure input stays on top
        transition: 'opacity 0.2s ease-in-out',
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
};
