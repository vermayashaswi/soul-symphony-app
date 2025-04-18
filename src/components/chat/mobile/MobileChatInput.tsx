
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
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

  // Effect to ensure input stays visible and detect keyboard
  useEffect(() => {
    // Function to detect keyboard visibility with multiple signals
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        // More aggressive detection threshold
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        
        if (isKeyboardVisible !== isKeyboard) {
          setIsKeyboardVisible(isKeyboard);
          
          // Dispatch events to notify other components about keyboard state
          const eventName = isKeyboard ? 'keyboardOpen' : 'keyboardClose';
          window.dispatchEvent(new Event(eventName));
          
          // Add class to body and interface for CSS targeting
          if (isKeyboard) {
            document.body.classList.add('keyboard-visible');
            document.querySelector('.mobile-chat-interface')?.classList.add('keyboard-visible');
          } else {
            document.body.classList.remove('keyboard-visible');
            document.querySelector('.mobile-chat-interface')?.classList.remove('keyboard-visible');
            
            // When keyboard closes, ensure we're scrolled to the bottom
            setTimeout(() => {
              window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
              });
            }, 100);
          }
        }
      }
    };

    // Run immediately and set up listeners
    handleVisualViewportResize();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.addEventListener('resize', handleVisualViewportResize);
    }
    
    // Also listen for focus events on the input
    const handleFocus = () => {
      // Assume keyboard will be visible soon after focus
      document.body.classList.add('keyboard-visible');
      document.querySelector('.mobile-chat-interface')?.classList.add('keyboard-visible');
      
      // Short delay to ensure keyboard has time to appear
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    };
    
    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener('focus', handleFocus);
    }
    
    // Ensure input visibility with a periodic check
    const ensureInputVisibility = () => {
      if (inputContainerRef.current) {
        inputContainerRef.current.style.visibility = 'visible';
        inputContainerRef.current.style.opacity = '1';
      }
    };
    
    // Run immediately and set interval
    ensureInputVisibility();
    const visibilityInterval = setInterval(ensureInputVisibility, 500);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.removeEventListener('resize', handleVisualViewportResize);
      }
      
      if (inputElement) {
        inputElement.removeEventListener('focus', handleFocus);
      }
      
      document.body.classList.remove('keyboard-visible');
      clearInterval(visibilityInterval);
    };
  }, [isKeyboardVisible]);

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

  return (
    <div 
      ref={inputContainerRef}
      className={`p-2 bg-background border-t border-border flex items-center gap-2 ${
        isKeyboardVisible ? 'input-keyboard-active' : ''
      }`}
      style={{
        position: 'fixed',
        bottom: isKeyboardVisible ? 0 : '69px', // Key change: position based on keyboard visibility
        left: 0,
        right: 0,
        paddingBottom: isKeyboardVisible ? '5px' : 'env(safe-area-inset-bottom, 8px)',
        marginBottom: 0,
        zIndex: 60, // High z-index to be above the navigation bar
        boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.07)',
        transition: 'all 0.2s ease',
        borderTop: isKeyboardVisible ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
        borderBottom: !isKeyboardVisible ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
        visibility: 'visible',
        opacity: 1,
        transform: 'translateZ(0)', // Force hardware acceleration
        willChange: 'transform, bottom', // Optimize for animation
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
