
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { cn } from "@/lib/utils";
import { useMasterAndroidKeyboardCoordinator } from "@/hooks/use-master-android-keyboard-coordinator";
import { usePlatformDetection } from "@/hooks/use-platform-detection";
import { Keyboard } from "@capacitor/keyboard";
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
  
  // Get platform info to conditionally use Android coordinator
  const { platform, isNative } = usePlatformDetection();
  
  // Only use Android keyboard coordinator on Android platforms
  const androidCoordinator = platform === 'android' ? useMasterAndroidKeyboardCoordinator(
    inputContainerRef,
    inputRef,
    {}, // No swipe callbacks needed for input
    {
      enableCapacitorOptimization: true,
      enableSwipeCoordination: true,
      enableCompositionOptimization: true,
      debugMode: false
    }
  ) : null;

  // Create a unified coordinator interface for all platforms
  const coordinator = androidCoordinator || {
    isMasterCoordinator: false,
    platform,
    isNative,
    isKeyboardVisible: false,
    keyboardHeight: 0,
    hasActiveSwipe: false,
    isComposing: false,
    optimizeForKeyboardInput: () => {},
    handleCompositionConflict: () => {}
  };

  const { isKeyboardVisible, keyboardHeight } = coordinator;

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

  // Update CSS variables for precise keyboard positioning
  useEffect(() => {
    console.log('[MobileChatInput] Keyboard state changed:', { 
      isKeyboardVisible, 
      keyboardHeight, 
      platform, 
      isNative,
      coordinatorActive: coordinator.isMasterCoordinator
    });
    
    // Set CSS variables for keyboard height
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      document.documentElement.style.setProperty('--capacitor-keyboard-height', `${keyboardHeight}px`);
    }
    
    if (isKeyboardVisible) {
      // Optimize input for keyboard interaction if using coordinator
      if (coordinator.isMasterCoordinator) {
        coordinator.optimizeForKeyboardInput();
      }
      
      // Enhanced scroll logic with swipe-aware timing
      const shouldRespectSwipeState = coordinator.isMasterCoordinator && (coordinator.hasActiveSwipe || false);
      const scrollDelay = shouldRespectSwipeState ? 500 : 200; // Longer delay if swipe is active
      
      setTimeout(() => {
        const chatContent = document.querySelector('.mobile-chat-content');
        if (chatContent) {
          chatContent.scrollTop = chatContent.scrollHeight;
          console.log('[MobileChatInput] Scrolled chat content to bottom');
        }
      }, scrollDelay);
    }
  }, [isKeyboardVisible, keyboardHeight, platform, isNative, coordinator]);


  if (isInChatTutorialStep) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isSubmitting) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputFocus = () => {
    console.log('[MobileChatInput] Input focused');
    
    // Optimize for keyboard input if using coordinator
    if (coordinator.isMasterCoordinator) {
      coordinator.optimizeForKeyboardInput();
    }
    
    // Check for composition conflicts
    if (coordinator.isMasterCoordinator && coordinator.isComposing) {
      coordinator.handleCompositionConflict('input-focus-during-composition');
    }
    
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
        
        // Clear input immediately for better UX
        setInputValue("");
        
        await Promise.resolve(onSendMessage(trimmedValue));
        
        // Blur input and hide the mobile keyboard after sending
        try {
          inputRef.current?.blur();
          if (document.activeElement && (document.activeElement as HTMLElement).blur) {
            (document.activeElement as HTMLElement).blur();
          }
        } catch {}

        try {
          await Keyboard.hide();
          // Some Android WebViews need a second hide call after a short delay
          setTimeout(() => {
            Keyboard.hide().catch(() => {});
          }, 50);
        } catch {
          // no-op on web or if plugin unavailable
        }
        
        chatDebug.addEvent("User Input", "Reset input field and hid keyboard after sending", "success");
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
        "mobile-chat-input-container flex items-center gap-3 p-3",
        isKeyboardVisible && "keyboard-visible",
        platform === 'android' && "platform-android",
        platform === 'ios' && "platform-ios",
        isNative && "platform-native",
        coordinator.isMasterCoordinator && "coordinator-active"
      )}
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
          className="w-full border border-muted shadow-sm bg-background text-foreground focus:outline-none focus:ring-0 focus:border-muted"
          disabled={isSubmitting}
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck="true"
          inputMode="text"
          data-testid="mobile-chat-input"
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
