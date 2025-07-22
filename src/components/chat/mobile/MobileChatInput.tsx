
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { cn } from "@/lib/utils";
import { useSafeArea } from "@/hooks/use-safe-area";
import { useKeyboardDetection } from "@/hooks/use-keyboard-detection";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const chatDebug = useDebugLog();
  const { isActive, isInStep } = useTutorial();
  const { translate, currentLanguage } = useTranslation();
  const { applySafeAreaStyles } = useSafeArea();
  
  // Use the new keyboard detection hook
  const { isKeyboardVisible, keyboardHeight, platform, isNative } = useKeyboardDetection();
  
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

  // Apply safe area styles to input container
  useEffect(() => {
    if (inputContainerRef.current) {
      applySafeAreaStyles(inputContainerRef.current);
    }
  }, [applySafeAreaStyles]);

  // Handle keyboard state changes and update CSS classes
  useEffect(() => {
    console.log('[MobileChatInput] Keyboard state changed:', { 
      isVisible: isKeyboardVisible, 
      height: keyboardHeight, 
      platform, 
      isNative 
    });
    
    // Update CSS classes for styling
    const chatInterface = document.querySelector('.mobile-chat-interface');
    if (chatInterface) {
      chatInterface.classList.toggle('keyboard-visible', isKeyboardVisible);
    }
    
    // Apply platform-specific classes
    document.body.classList.toggle('keyboard-visible', isKeyboardVisible);
    document.body.classList.toggle(`platform-${platform}`, true);
    
    if (isKeyboardVisible) {
      // When keyboard opens, ensure input stays focused and scroll to bottom
      setTimeout(() => {
        if (inputRef.current) {
          // Scroll the chat content to bottom
          const chatContent = document.querySelector('.mobile-chat-content');
          if (chatContent) {
            chatContent.scrollTop = chatContent.scrollHeight;
          }
        }
      }, 100);
    } else {
      // When keyboard closes, scroll to bottom to show latest messages
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [isKeyboardVisible, keyboardHeight, platform, isNative]);

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

  return (
    <div 
      ref={inputContainerRef}
      className={cn(
        "mobile-chat-input-container",
        "p-2 border-t border-border flex items-center gap-2 bg-background",
        isKeyboardVisible && 'keyboard-visible',
        platform === 'android' && 'platform-android',
        platform === 'ios' && 'platform-ios'
      )}
      style={{
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
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
}
