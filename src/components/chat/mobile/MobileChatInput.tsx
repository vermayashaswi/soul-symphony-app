
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { cn } from "@/lib/utils";
import { useKeyboardDetection } from "@/hooks/use-keyboard-detection";
import { useNativeKeyboard } from "@/hooks/use-native-keyboard";
import { useCompositionEvents } from "@/hooks/use-composition-events";
import { useMobileKeyboardErrorRecovery } from "@/hooks/use-mobile-keyboard-error-recovery";
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
  
  const { isKeyboardVisible, keyboardHeight, platform, isNative, isReady } = useKeyboardDetection();
  const { isOptimized } = useNativeKeyboard();
  const { isComposing, keyboardType } = useCompositionEvents(inputRef, { preventConflicts: false, androidOptimized: true });
const { recoverFromSwipeConflict } = useMobileKeyboardErrorRecovery({ enableDebugMode: false, autoRecovery: false, recoveryDelay: 200 });
// Track previous visibility to avoid focus flapping
const prevKeyboardVisibleRef = useRef(false);

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

  // Handle keyboard state changes and ensure proper scrolling
  useEffect(() => {
    if (!isReady) return;

    const prevVisible = prevKeyboardVisibleRef.current;
    
    console.log('[MobileChatInput] Keyboard state:', { 
      isVisible: isKeyboardVisible, 
      height: keyboardHeight, 
      platform, 
      isNative 
    });
    
    // Only act when the keyboard transitions from closed -> open
    if (!prevVisible && isKeyboardVisible && inputRef.current) {
      setTimeout(() => {
        const chatContent = document.querySelector('.mobile-chat-content');
        if (chatContent) {
          chatContent.scrollTop = chatContent.scrollHeight;
        }
        
        // Avoid forcing a blur/refocus loop
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      }, 100);
    }

    // Update previous visibility state
    prevKeyboardVisibleRef.current = isKeyboardVisible;
  }, [isKeyboardVisible, keyboardHeight, platform, isNative, isReady]);

  // IMPROVED: Apply container classes with better coordination
  useEffect(() => {
    if (!inputContainerRef.current || !isReady) return;
    
    const container = inputContainerRef.current;
    
    // Apply keyboard state and platform classes (let the hook manage these)
    // These classes are managed by useKeyboardState hook, but we ensure they're present
    container.classList.toggle('keyboard-visible', isKeyboardVisible);
    container.classList.toggle(`platform-${platform}`, true);
    
    // Debug attributes - DISABLED for production
    // container.setAttribute('data-debug', 'true');
    container.setAttribute('data-keyboard-visible', isKeyboardVisible.toString());
    container.setAttribute('data-platform', platform);
    container.setAttribute('data-keyboard-height', keyboardHeight.toString());
    
    console.log('[MobileChatInput] Updated container classes:', {
      keyboardVisible: isKeyboardVisible,
      platform,
      height: keyboardHeight,
      classes: container.className
    });
  }, [isKeyboardVisible, platform, keyboardHeight, isReady]);

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
        
        await Promise.resolve(onSendMessage(trimmedValue));
        
        setInputValue("");
        
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
        "mobile-chat-input-container",
        "flex items-center gap-3 p-3",
        // Note: keyboard-visible and platform classes are managed by useKeyboardState hook
        !isReady && 'opacity-0'
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
          disabled={isSubmitting || isLoading}
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
