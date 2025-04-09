
import React, { useRef, useEffect, useState } from "react";
import ChatMessage from "./ChatMessage";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ChatMessage as ChatMessageType } from "@/services/chatPersistenceService";

interface ChatAreaProps {
  chatMessages: ChatMessageType[];
  isLoading: boolean;
  processingStage?: string;
}

const ChatArea: React.FC<ChatAreaProps> = ({ 
  chatMessages, 
  isLoading, 
  processingStage 
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [prevMessageCount, setPrevMessageCount] = useState(0);
  const [lastUserMessage, setLastUserMessage] = useState<ChatMessageType | null>(null);
  const [localIsLoading, setLocalIsLoading] = useState(isLoading);
  const [localProcessingStage, setLocalProcessingStage] = useState(processingStage);
  
  // When loading changes externally, update local loading state
  useEffect(() => {
    // If loading is starting, always update immediately
    if (isLoading) {
      setLocalIsLoading(true);
      setLocalProcessingStage(processingStage);
    } 
    // If loading is ending, only update if we don't have an active processingStage stored
    else if (!localProcessingStage || processingStage === null) {
      setLocalIsLoading(false);
      setLocalProcessingStage(null);
    }
  }, [isLoading, processingStage]);
  
  // Store loading state in sessionStorage to persist across navigation
  useEffect(() => {
    // Check for loading state on mount
    const storedLoadingState = sessionStorage.getItem('chatLoadingState');
    const storedProcessingStage = sessionStorage.getItem('chatProcessingStage');
    
    if (storedLoadingState === 'true' && !isLoading) {
      setLocalIsLoading(true);
      if (storedProcessingStage) {
        setLocalProcessingStage(storedProcessingStage);
      }
    }
    
    // Update storage when loading state changes
    if (localIsLoading) {
      sessionStorage.setItem('chatLoadingState', 'true');
      if (localProcessingStage) {
        sessionStorage.setItem('chatProcessingStage', localProcessingStage);
      }
    } else {
      sessionStorage.removeItem('chatLoadingState');
      sessionStorage.removeItem('chatProcessingStage');
    }
    
    // Clean up storage when component unmounts if we're no longer loading
    return () => {
      if (!localIsLoading) {
        sessionStorage.removeItem('chatLoadingState');
        sessionStorage.removeItem('chatProcessingStage');
      }
    };
  }, [localIsLoading, localProcessingStage, isLoading]);
  
  // Find the last user message
  useEffect(() => {
    if (chatMessages.length > 0) {
      const lastMsg = [...chatMessages].reverse().find(msg => msg.role === 'user');
      setLastUserMessage(lastMsg || null);
    } else {
      setLastUserMessage(null);
    }

    // Only scroll to bottom if:
    // 1. New messages were added
    // 2. Loading state changed
    // 3. First render
    if (chatMessages.length > prevMessageCount || localIsLoading !== undefined) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setPrevMessageCount(chatMessages.length);
    }
    
    // If we have a completed response, clear the loading state
    if (chatMessages.length > prevMessageCount && prevMessageCount > 0) {
      setLocalIsLoading(false);
      setLocalProcessingStage(null);
      sessionStorage.removeItem('chatLoadingState');
      sessionStorage.removeItem('chatProcessingStage');
    }
  }, [chatMessages, localIsLoading, prevMessageCount]);
  
  // Check for duplicates by content to prevent doubled rendering
  const uniqueMessages = chatMessages.reduce((acc: ChatMessageType[], current) => {
    const isDuplicate = acc.find(item => 
      item.id === current.id || 
      (item.content === current.content && 
       Math.abs(new Date(item.created_at).getTime() - new Date(current.created_at).getTime()) < 1000)
    );
    if (!isDuplicate) {
      acc.push(current);
    }
    return acc;
  }, []);
  
  // Filter out the last user message when loading to show it in the sticky header
  const filteredMessages = localIsLoading && lastUserMessage 
    ? uniqueMessages.filter(msg => msg.id !== lastUserMessage.id)
    : uniqueMessages;
  
  return (
    <div className="flex flex-col h-full">
      {localIsLoading && lastUserMessage && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-3 pt-2 px-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
              You
            </div>
            <div className="bg-muted p-3 rounded-xl max-w-[75%] text-sm">
              {lastUserMessage.content}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <AnimatePresence initial={false}>
          {filteredMessages.map((message, index) => {
            // Map 'error' role to 'assistant' for display purposes if needed
            const displayMessage = {
              ...message,
              // Use type assertion to allow for potential 'error' role which might come from elsewhere
              role: (message.role as string) === 'error' ? 'assistant' : message.role
            };
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChatMessage 
                  message={displayMessage}
                  showAnalysis={false}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        <AnimatePresence>
          {localIsLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <div className="bg-muted/40 rounded-xl p-3 max-w-[75%] text-sm">
                {localProcessingStage || "Processing your request..."}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatArea;
