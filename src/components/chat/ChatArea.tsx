
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
  
  useEffect(() => {
    // Only scroll to bottom if:
    // 1. New messages were added
    // 2. Loading state changed
    // 3. First render
    if (chatMessages.length > prevMessageCount || isLoading !== undefined) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setPrevMessageCount(chatMessages.length);
    }
  }, [chatMessages, isLoading, prevMessageCount]);
  
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
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <AnimatePresence initial={false}>
          {uniqueMessages.map((message, index) => {
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
          {isLoading && (
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
                {processingStage || "Processing your request..."}
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
