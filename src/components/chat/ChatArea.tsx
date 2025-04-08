
import React, { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export type ChatMessageType = {
  role: 'user' | 'assistant' | 'error';
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
};

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
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoading]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {chatMessages.map((message, index) => (
          <ChatMessage 
            key={index} 
            message={message}
            showAnalysis={false}
          />
        ))}
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
        
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatArea;
