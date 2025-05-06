import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useTranslation } from '@/contexts/TranslationContext';
import VoiceRecordingButton from './VoiceRecordingButton';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  isSending?: boolean;
  isLoading?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  userId?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  isSending = false,
  isLoading = false,
  autoFocus = false,
  placeholder = "Your message...",
  className = "",
  userId
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { translate } = useTranslation();
  const [translatedPlaceholder, setTranslatedPlaceholder] = useState(placeholder);
  
  useEffect(() => {
    const updatePlaceholder = async () => {
      if (translate) {
        try {
          const result = await translate(placeholder, "en");
          if (result) {
            setTranslatedPlaceholder(result);
          }
        } catch (err) {
          console.error("Error translating placeholder:", err);
        }
      }
    };
    
    updatePlaceholder();
  }, [placeholder, translate]);
  
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleSendMessage = useCallback(() => {
    if (message.trim() && !disabled && !isSending) {
      onSendMessage(message);
      setMessage('');
    }
  }, [message, disabled, isSending, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Add this function to match the component usage in ChatInput
  const handleVoiceInput = (transcription: string) => {
    if (transcription && transcription.trim()) {
      onSendMessage(transcription.trim());
    }
  };

  return (
    <div className={`flex items-end gap-2 ${className}`} id="chat-input" data-tutorial="chat-input">
      <div className="flex-grow relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          placeholder={translatedPlaceholder}
          disabled={disabled || isSending || isLoading}
          className="min-h-[60px] resize-none pr-10"
          rows={1}
        />
        
        {/* Voice input button floating inside textarea */}
        <div className="absolute right-2 bottom-2">
          <VoiceRecordingButton
            onTranscriptionComplete={handleVoiceInput}
            size="sm"
            variant="ghost"
            disabled={disabled || isSending || isLoading}
          />
        </div>
      </div>
      
      <div>
        <motion.div
          whileTap={{ scale: 0.9 }}
        >
          <Button 
            onClick={handleSendMessage}
            disabled={!message.trim() || disabled || isSending || isLoading}
            size="icon"
            className="h-[60px] w-[60px] rounded-full"
          >
            {isSending || isLoading ? (
              <div className="h-5 w-5 border-t-2 border-primary-foreground rounded-full animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default ChatInput;
