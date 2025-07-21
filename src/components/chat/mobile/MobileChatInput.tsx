
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useSafeAreaUnified } from "@/hooks/use-safe-area-unified";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const { isActive, isInStep } = useTutorial();
  const { translate, currentLanguage } = useTranslation();
  const { safeArea, isInitialized } = useSafeAreaUnified();
  const { isKeyboardVisible } = useKeyboardDetection();
  
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

  // Apply safe area styles
  useEffect(() => {
    if (containerRef.current && isInitialized) {
      containerRef.current.style.setProperty('--element-safe-area-left', `${safeArea.left}px`);
      containerRef.current.style.setProperty('--element-safe-area-right', `${safeArea.right}px`);
      containerRef.current.style.setProperty('--element-safe-area-bottom', `${safeArea.bottom}px`);
    }
  }, [safeArea, isInitialized]);

  // If we're in step 5 of the tutorial, don't render
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

  const handleSendMessage = async () => {
    if (isLoading || isSubmitting) return;

    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      try {
        setIsSubmitting(true);
        onSendMessage(trimmedValue);
        setInputValue("");
        if (inputRef.current) {
          inputRef.current.focus();
        }
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="mobile-chat-input"
    >
      <div className="p-3 flex items-center gap-2">
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
    </div>
  );
}
