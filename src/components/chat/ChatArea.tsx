
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '@/hooks/use-chat';
import { ChatMessage as ChatMessageType } from '@/services/chat';
import ChatMessage from '@/components/chat/ChatMessage';
import MobileChatMessage from '@/components/chat/mobile/MobileChatMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, ChevronDown, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useDebugMode } from '@/hooks/use-debug-mode';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useTheme } from '@/hooks/use-theme';

// Helper function to check if a message has analysis data
const hasAnalysisParam = (message: ChatMessageType) => {
  return message && message.analysis_data && Object.keys(message.analysis_data).length > 0;
};

interface ChatAreaProps {
  threadId?: string | null;
  initialMessages?: ChatMessageType[];
  onNewMessage?: (message: ChatMessageType) => void;
  suggestedQuestions?: string[];
  showSuggestions?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  showScrollButton?: boolean;
  messages?: ChatMessageType[]; // Add this to make it compatible with SmartChatInterface
  isLoading?: boolean; // Add this to make it compatible with SmartChatInterface
  processingStage?: string; // Add this to make it compatible with SmartChatInterface
}

const ChatArea: React.FC<ChatAreaProps> = ({
  threadId = null,
  initialMessages = [],
  onNewMessage,
  suggestedQuestions = [],
  showSuggestions = true,
  className = '',
  placeholder = 'Type a message...',
  autoFocus = true,
  showScrollButton = true,
  messages: externalMessages, // New prop for external message control
  isLoading: externalIsLoading, // New prop for external loading state
}) => {
  // Replace router with navigate
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { showDebugMode } = useDebugMode();
  const { theme } = useTheme();
  const { isTranslating } = useTranslation();
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get chat functionality from our hook
  const {
    messages: hookMessages,
    sendMessage,
    isLoading: hookIsLoading,
    error,
    isComplete,
    clearMessages,
  } = useChat({
    threadId,
    initialMessages,
    onNewMessage,
  });

  // Use external messages if provided, otherwise use hook messages
  const messages = externalMessages || hookMessages;
  // Use external loading state if provided, otherwise use hook loading state
  const isLoading = externalIsLoading !== undefined ? externalIsLoading : hookIsLoading;
  
  // Use our scroll to bottom hook
  const { scrollToBottom } = useScrollToBottom(messagesEndRef);
  
  // Store the last message ID to avoid duplicate scrolling
  const lastMessageIdRef = useRef<string | null>(null);
  
  // Handle scroll events to show/hide scroll button
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setShowScrollToBottom(!isAtBottom && hasScrolled);
    
    if (!hasScrolled && scrollTop > 100) {
      setHasScrolled(true);
    }
  };
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only scroll if this is a new message
    if (lastMessage.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessage.id;
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);
  
  // Set up scroll event listener
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
      return () => chatContainer.removeEventListener('scroll', handleScroll);
    }
  }, [hasScrolled]);
  
  // Auto-focus input on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [autoFocus, isMobile]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    try {
      await sendMessage(input);
      setInput('');
      // Scroll to bottom after sending
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Handle suggested question click
  const handleSuggestedQuestionClick = async (question: string) => {
    if (isLoading) return;
    
    try {
      await sendMessage(question);
      // Scroll to bottom after sending
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error sending suggested question:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Render suggested questions
  const renderSuggestedQuestions = () => {
    if (!showSuggestions || suggestedQuestions.length === 0 || messages.length > 0) {
      return null;
    }
    
    return (
      <div className="mb-4 space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          <TranslatableText text="Suggested questions:" />
        </h3>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((question, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="chat-question-suggestion text-xs h-auto py-1.5 px-2.5 bg-background/80 hover:bg-background"
              onClick={() => handleSuggestedQuestionClick(question)}
              disabled={isLoading}
            >
              <TranslatableText text={question} />
            </Button>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chat messages container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        onScroll={handleScroll}
      >
        {/* Render suggested questions if available */}
        {renderSuggestedQuestions()}
        
        {/* Render messages */}
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          
          return isMobile ? (
            <MobileChatMessage 
              key={message.id || index}
              message={{
                role: message.role as 'user' | 'assistant' | 'error',
                content: message.content,
                analysis: message.analysis_data,
                references: Array.isArray(message.reference_entries) 
                  ? message.reference_entries 
                  : (message.reference_entries ? [message.reference_entries] : []),
                hasNumericResult: message.has_numeric_result
              }}
              showAnalysis={showDebugMode && hasAnalysisParam(message)}
            />
          ) : (
            <ChatMessage 
              key={message.id || index}
              message={message} 
              isLastMessage={isLast} 
              isComplete={isComplete} 
              threadId={threadId}
              showAnalysis={showDebugMode && hasAnalysisParam(message)}
            />
          );
        })}
        
        {/* Loading indicator for first message */}
        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
            <p className="font-medium">
              <TranslatableText text="Error:" />
            </p>
            <p>
              <TranslatableText text={error} />
            </p>
          </div>
        )}
        
        {/* Empty div for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Scroll to bottom button */}
      {showScrollButton && showScrollToBottom && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-20 right-4 rounded-full shadow-md bg-background"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
      
      {/* Input form */}
      <form 
        onSubmit={handleSubmit} 
        className="border-t bg-background p-4 sticky bottom-0 z-10"
      >
        <div className="flex items-center gap-2">
          <Input
            id="chat-input"
            ref={inputRef}
            type="text"
            placeholder={isTranslating ? "Translating..." : placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || isTranslating}
            className="flex-1"
            autoComplete="off"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!input.trim() || isLoading || isTranslating}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatArea;
