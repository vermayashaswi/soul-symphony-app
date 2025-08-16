
import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
  userId
}) => {
  const [message, setMessage] = useState("");
  const [placeholderText, setPlaceholderText] = useState("Type your message...");
  const isMobile = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const { isActive, isInStep, tutorialCompleted } = useTutorial();
  const { translate, currentLanguage } = useTranslation();
  
  // Check if we're in the chat tutorial step
  const isInTutorial = isActive && isInStep(5);

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

  // Simplified tutorial visibility management
  useEffect(() => {
    if (inputContainerRef.current) {
      if (isInTutorial) {
        // Hide during tutorial step 5
        inputContainerRef.current.style.display = 'none';
      } else {
        // Show and ensure full functionality when not in tutorial
        inputContainerRef.current.style.display = 'block';
        inputContainerRef.current.style.opacity = '1';
        inputContainerRef.current.style.pointerEvents = 'auto';
        inputContainerRef.current.style.visibility = 'visible';
        inputContainerRef.current.style.zIndex = '20';
        
        // Clear any conflicting styles that might prevent interaction
        inputContainerRef.current.style.height = 'auto';
        inputContainerRef.current.style.overflow = 'visible';
        inputContainerRef.current.style.margin = '';
        inputContainerRef.current.style.padding = '';
      }
    }
  }, [isInTutorial, tutorialCompleted]);

  // Don't render anything during tutorial step 5
  if (isInTutorial) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;
    
    console.log('[ChatInput] Submitting message:', message.substring(0, 50));
    onSendMessage(message);
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight(e.target);
  };

  return (
    <div 
      className="chat-input-container w-full" 
      style={{ 
        marginBottom: '5px', 
        position: 'relative', 
        zIndex: 20,
      }}
      ref={inputContainerRef}
    >
      <form onSubmit={handleSubmit} className="relative flex items-center w-full">
        <div className="flex items-center w-full relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            placeholder={placeholderText}
            className="min-h-[24px] h-[32px] text-sm md:text-base resize-none rounded-full pl-4 pr-12 py-0 shadow-sm border-muted bg-background text-foreground overflow-hidden focus:outline-none focus:ring-0 focus:border-muted cursor-text"
            disabled={isLoading}
            style={{ 
              pointerEvents: 'auto',
              cursor: 'text'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            onFocus={() => {
              console.log('[ChatInput] Textarea focused');
              // Only for mobile, ensure the textarea is visible when focused
              if (isMobile) {
                setTimeout(() => {
                  window.scrollTo({
                    top: document.body.scrollHeight,
                    behavior: 'smooth'
                  });
                  textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 300);
              }
            }}
            onClick={() => {
              console.log('[ChatInput] Textarea clicked');
            }}
          />
        </div>
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
          <Button 
            type="submit" 
            size={isMobile ? "sm" : "default"}
            className="rounded-full h-7 w-7 p-0 bg-primary text-primary-foreground"
            disabled={isLoading || !message.trim()}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
