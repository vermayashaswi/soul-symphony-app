import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useDebugLog } from "@/utils/debug/DebugContext";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { cn } from "@/lib/utils";
import { useUnifiedKeyboard } from "@/hooks/use-unified-keyboard";
import { VoiceChatRecorder } from "./VoiceChatRecorder";

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
  
  const { 
    isKeyboardVisible, 
    keyboardHeight, 
    platform, 
    isNative,
    isMobileBrowser,
    isCapacitorWebView,
    hideKeyboard 
  } = useUnifiedKeyboard();

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
    console.log('[MobileChatInput] Unified keyboard state changed:', { 
      isKeyboardVisible, 
      keyboardHeight, 
      platform, 
      isNative,
      isMobileBrowser,
      isCapacitorWebView
    });
    
    if (isKeyboardVisible) {
      const scrollDelay = isMobileBrowser ? 300 : isCapacitorWebView ? 100 : 50;
      
      setTimeout(() => {
        const chatContent = document.querySelector('.mobile-chat-content');
        if (chatContent) {
          chatContent.scrollTop = chatContent.scrollHeight;
          console.log('[MobileChatInput] Scrolled chat content to bottom');
          
          // Additional scroll for mobile browsers
          if (isMobileBrowser) {
            setTimeout(() => {
              chatContent.scrollTop = chatContent.scrollHeight;
            }, 100);
          }
        }
      }, scrollDelay);
    }
  }, [isKeyboardVisible, keyboardHeight, platform, isNative, isMobileBrowser, isCapacitorWebView]);

  // Don't render during tutorial step 5
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
        
        // Clear input immediately for better UX
        setInputValue("");
        
        await Promise.resolve(onSendMessage(trimmedValue));
        
        // Keep input focused to maintain keyboard state
        if (inputRef.current) {
          inputRef.current.focus();
        }

        // Use unified keyboard hiding only if explicitly requested
        if (hideKeyboard && !isMobileBrowser) {
          try {
            await hideKeyboard();
          } catch (error) {
            console.warn('[MobileChatInput] Failed to hide keyboard:', error);
          }
        }
        
        chatDebug.addEvent("User Input", "Message sent successfully", "success");
      } catch (error) {
        console.error("Error sending message:", error);
        chatDebug.addEvent("Send Error", error instanceof Error ? error.message : "Unknown error sending message", "error");
        // Restore input value on error
        setInputValue(trimmedValue);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleVoiceTranscription = async (transcribedText: string) => {
    try {
      chatDebug.addEvent("Voice Message", `Voice transcribed: "${transcribedText.substring(0, 30)}${transcribedText.length > 30 ? '...' : ''}"`, "info");
      
      // Send the transcribed message with audio flag
      await Promise.resolve(onSendMessage(transcribedText, true));
      
      chatDebug.addEvent("Voice Input", "Voice message sent successfully", "success");
    } catch (error) {
      console.error("Error sending voice message:", error);
      chatDebug.addEvent("Voice Error", error instanceof Error ? error.message : "Unknown error sending voice message", "error");
    }
  };

  return (
    <div 
      ref={inputContainerRef}
      className={cn(
        "mobile-chat-input-container flex items-center gap-2 p-3 relative",
        isKeyboardVisible && "keyboard-visible",
        isCapacitorWebView && isKeyboardVisible && "capacitor-keyboard-visible",
        isMobileBrowser && isKeyboardVisible && "mobile-browser-keyboard-visible",
        platform === 'android' && "platform-android",
        platform === 'ios' && "platform-ios"
      )}
    >
      {/* Text Input Container */}
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onFocus={handleInputFocus}
          placeholder={placeholderText}
          className="w-full pr-12 border border-muted shadow-sm bg-background text-foreground focus:outline-none focus:ring-0 focus:border-muted"
          disabled={isSubmitting}
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck="true"
          inputMode="text"
          data-testid="mobile-chat-input"
        />
        
        {/* Voice Recorder - positioned only over the mic button area */}
        <VoiceChatRecorder
          onTranscriptionComplete={handleVoiceTranscription}
          isDisabled={isSubmitting || isLoading}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8"
        />
      </div>
      
      {/* Send Button */}
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
