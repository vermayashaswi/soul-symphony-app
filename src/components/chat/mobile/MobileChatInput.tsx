
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { keyboardDetectionService, KeyboardState } from "@/services/keyboardDetectionService";

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
  const [placeholderText, setPlaceholderText] = useState("Type your message...");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    timestamp: Date.now()
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const chatDebug = useDebugLog();
  const { isActive, isInStep } = useTutorial();
  const { translate, currentLanguage } = useTranslation();
  
  // Check if we're in step 5 (chat question step)
  const isInChatTutorialStep = isActive && isInStep(5);

  // Translate placeholder text when language changes
  useEffect(() => {
    const translatePlaceholder = async () => {
      try {
        if (currentLanguage === 'en') {
          setPlaceholderText("Type your message...");
        } else {
          const translated = await translate("Type your message...");
          setPlaceholderText(translated || "Type your message...");
        }
      } catch (error) {
        console.error('Error translating placeholder:', error);
        setPlaceholderText("Type your message...");
      }
    };

    translatePlaceholder();
  }, [currentLanguage, translate]);

  // Use centralized keyboard detection service
  useEffect(() => {
    if (isInChatTutorialStep) return;

    const listenerId = 'mobile-chat-input';
    
    keyboardDetectionService.addListener(listenerId, (state: KeyboardState) => {
      console.log('MobileChatInput: Keyboard state changed:', state);
      setKeyboardState(state);
      
      // Update CSS classes for global styling
      if (state.isVisible) {
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
    });
    
    return () => {
      keyboardDetectionService.removeListener(listenerId);
    };
  }, [isInChatTutorialStep]);

  // If we're in step 5 of the tutorial, don't render anything at all
  if (isInChatTutorialStep) {
    console.log("In tutorial step 5 - not rendering chat input at all");
    return null;
  }

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

  // Calculate bottom positioning based on keyboard state and navigation
  const getBottomPosition = () => {
    if (keyboardState.isVisible) {
      // When keyboard is visible, position at bottom of viewport
      return '0px';
    } else {
      // When keyboard is hidden, position above navigation bar
      return '64px'; // Standard navigation height + padding
    }
  };

  return (
    <div 
      ref={inputContainerRef}
      className={`fixed left-0 right-0 z-[60] p-2 border-t border-border flex items-center gap-2 bg-background ${
        keyboardState.isVisible ? 'input-keyboard-active' : ''
      }`}
      style={{
        bottom: getBottomPosition(),
        paddingBottom: keyboardState.isVisible ? '8px' : '12px',
        boxShadow: keyboardState.isVisible 
          ? '0 -2px 8px rgba(0, 0, 0, 0.1)' 
          : '0 -1px 3px rgba(0, 0, 0, 0.07)',
        transition: 'all 0.2s ease-out',
        transform: 'translateZ(0)', // Force GPU acceleration
      }}
    >
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={placeholderText}
          className="w-full pr-10 focus:outline-none focus:ring-2 focus:ring-primary border-2 border-primary/40 shadow-[0_0_8px_rgba(155,135,245,0.5)] bg-background text-foreground"
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
