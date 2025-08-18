
import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import { useTutorial } from "@/contexts/TutorialContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { VoiceChatRecorder, RecordingState } from "@/components/chat/mobile/VoiceChatRecorder";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userId?: string;
  onVoiceTranscription?: (transcribedText: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
  userId,
  onVoiceTranscription
}) => {
  const [message, setMessage] = useState("");
  const [placeholderText, setPlaceholderText] = useState("Type your message...");
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
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

  // Effect to manage visibility during and after tutorial
  useEffect(() => {
    const ensureInputVisibility = () => {
      if (inputContainerRef.current) {
        if (isInTutorial) {
          // Completely hide input during tutorial step 5
          inputContainerRef.current.style.opacity = '0';
          inputContainerRef.current.style.pointerEvents = 'none';
          inputContainerRef.current.style.height = '0';
          inputContainerRef.current.style.visibility = 'hidden';
          inputContainerRef.current.style.overflow = 'hidden';
          inputContainerRef.current.style.margin = '0';
          inputContainerRef.current.style.padding = '0';
          inputContainerRef.current.style.backgroundColor = 'transparent';
          inputContainerRef.current.style.border = 'none';
          inputContainerRef.current.style.boxShadow = 'none';
        } else {
          // Show normally when not in tutorial or when tutorial completed
          inputContainerRef.current.style.opacity = '1';
          inputContainerRef.current.style.pointerEvents = 'auto';
          inputContainerRef.current.style.cursor = 'text';
          inputContainerRef.current.style.display = 'block';
          inputContainerRef.current.style.visibility = 'visible';
          inputContainerRef.current.style.height = 'auto';
          inputContainerRef.current.style.zIndex = '20';
          inputContainerRef.current.style.margin = '';
          inputContainerRef.current.style.padding = '';
          inputContainerRef.current.style.backgroundColor = '';
          inputContainerRef.current.style.border = '';
          inputContainerRef.current.style.boxShadow = '';
        }
      }
    };

    // Run on initial render and whenever relevant states change
    ensureInputVisibility();
    
    // Recheck visibility after a delay to handle any DOM updates
    const visibilityTimeout = setTimeout(ensureInputVisibility, 300);
    
    return () => {
      clearTimeout(visibilityTimeout);
    };
  }, [isLoading, isInTutorial, tutorialCompleted]);

  // If completely hidden during step 5, return an empty div with height 0 (not 40px)
  if (isInTutorial) {
    return <div ref={inputContainerRef} className="chat-input-container opacity-0 h-0 overflow-hidden" style={{ height: '0', padding: 0, margin: 0, border: 'none', backgroundColor: 'transparent' }}></div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
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

  const handleVoiceTranscription = async (transcribedText: string) => {
    if (onVoiceTranscription) {
      await onVoiceTranscription(transcribedText);
    } else {
      // Fallback: insert into text input
      setMessage(prev => prev + transcribedText);
    }
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
            className="min-h-[24px] h-[32px] text-sm md:text-base resize-none rounded-full pl-4 pr-12 py-0 shadow-sm border-muted bg-background text-foreground overflow-hidden focus:outline-none focus:ring-0 focus:border-muted"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            onFocus={() => {
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
          />
        </div>
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {/* Voice Recorder */}
          <VoiceChatRecorder
            onTranscriptionComplete={handleVoiceTranscription}
            isDisabled={isLoading}
            className="w-7 h-7"
            onRecordingStateChange={setRecordingState}
          />
          
          {/* Send Button */}
          <Button 
            type="submit" 
            size={isMobile ? "sm" : "default"}
            className="rounded-full h-7 w-7 p-0 bg-primary text-primary-foreground"
            disabled={isLoading}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
