
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { cn } from "@/lib/utils";
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
  
  const { isKeyboardVisible, keyboardHeight, platform, isNative, isReady } = useKeyboardDetection();
  
  const isInChatTutorialStep = isActive && isInStep(5);

  // Translate placeholder
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

  // Enhanced keyboard state handling with better coordination
  useEffect(() => {
    if (!isReady || !inputContainerRef.current) return;
    
    const container = inputContainerRef.current;
    
    console.log('[MobileChatInput] Keyboard state change:', { 
      isVisible: isKeyboardVisible, 
      height: keyboardHeight, 
      platform, 
      isNative,
      containerBottom: getComputedStyle(container).bottom
    });
    
    // Apply keyboard state classes and attributes
    container.classList.toggle('keyboard-visible', isKeyboardVisible);
    container.setAttribute('data-keyboard-visible', isKeyboardVisible.toString());
    container.setAttribute('data-keyboard-height', keyboardHeight.toString());
    
    // Force immediate positioning for keyboard state
    if (isKeyboardVisible) {
      container.style.bottom = platform === 'ios' 
        ? 'var(--calculated-safe-area-bottom, env(safe-area-inset-bottom, 0px))' 
        : '0px';
    } else {
      container.style.bottom = '';
    }
    
    // Ensure proper scrolling when keyboard opens
    if (isKeyboardVisible && inputRef.current) {
      setTimeout(() => {
        const chatContent = document.querySelector('.mobile-chat-content');
        if (chatContent) {
          chatContent.scrollTop = chatContent.scrollHeight;
        }
        
        // Ensure input stays focused and visible
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
          inputRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }
      }, 100);
    }
  }, [isKeyboardVisible, keyboardHeight, platform, isNative, isReady]);

  // Platform-specific class application
  useEffect(() => {
    if (!inputContainerRef.current || !isReady) return;
    
    const container = inputContainerRef.current;
    
    // Apply platform classes
    container.classList.toggle(`platform-${platform}`, true);
    
    console.log('[MobileChatInput] Platform classes applied:', {
      platform,
      classes: container.className,
      isReady
    });
  }, [platform, isReady]);

  if (isInChatTutorialStep) {
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

  const handleInputFocus = () => {
    console.log('[MobileChatInput] Input focused');
    // Slight delay to ensure keyboard detection fires first
    setTimeout(() => {
      const chatContent = document.querySelector('.mobile-chat-content');
      if (chatContent) {
        chatContent.scrollTop = chatContent.scrollHeight;
      }
    }, 200);
  };

  const handleSendMessage = async () => {
    if (isLoading || isSubmitting) return;

    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      try {
        chatDebug.addEvent("User Message", `Preparing to send: "${trimmedValue.substring(0, 30)}${trimmedValue.length > 30 ? '...' : ''}"`, "info");
        setIsSubmitting(true);
        
        onSendMessage(trimmedValue);
        
        setInputValue("");
        
        // Keep focus on input after sending
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
        "flex items-center gap-3",
        isKeyboardVisible && 'keyboard-visible',
        platform === 'android' && 'platform-android',
        platform === 'ios' && 'platform-ios',
        !isReady && 'opacity-0'
      )}
      style={{
        // Inline styles for immediate keyboard positioning
        bottom: isKeyboardVisible 
          ? (platform === 'ios' ? 'var(--calculated-safe-area-bottom, env(safe-area-inset-bottom, 0px))' : '0px')
          : undefined,
        transition: isKeyboardVisible ? 'none' : 'bottom 0.2s ease-in-out'
      }}
    >
      <div className="flex-1">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onFocus={handleInputFocus}
          placeholder={placeholderText}
          className="w-full border-2 border-primary/40 focus:border-primary shadow-sm bg-background text-foreground"
          disabled={isLoading || isSubmitting}
        />
      </div>
      
      <Button
        type="button"
        size="icon"
        className="h-10 w-10 rounded-full shrink-0"
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
  );
}
