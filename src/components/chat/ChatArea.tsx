
import React, { useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { useDebugMode } from "@/contexts/DebugModeContext";
import { ChatMessage as ChatMessageType } from "@/types/chat";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface ChatAreaProps {
  chatMessages: ChatMessageType[];
  isLoading?: boolean;
  processingStage?: string;
  threadId?: string | null;
  onInteractiveOptionClick?: (option: any) => void;
}

const ChatArea = ({ 
  chatMessages, 
  isLoading, 
  processingStage,
  threadId,
  onInteractiveOptionClick
}: ChatAreaProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { debugMode } = useDebugMode();

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="h-full overflow-y-auto p-4 pb-24">
      <div className="max-w-3xl mx-auto">
        {chatMessages.map((message, index) => (
          <ChatMessage 
            key={`${message.id || index}`} 
            message={{
              role: message.role === 'error' ? 'assistant' : message.role, // Handle error role
              content: message.content,
              references: Array.isArray(message.references) ? message.references : 
                         Array.isArray(message.reference_entries) ? message.reference_entries : [],
              analysis: message.analysis || message.analysis_data,
              hasNumericResult: message.hasNumericResult || message.has_numeric_result,
              ambiguityInfo: message.ambiguityInfo,
              isInteractive: message.isInteractive,
              interactiveOptions: message.interactiveOptions,
              diagnostics: message.diagnostics
            }}
            showAnalysis={debugMode} 
            onInteractiveOptionClick={onInteractiveOptionClick}
          />
        ))}
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-2 p-4 my-2 rounded-lg bg-primary/5">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-sm text-muted-foreground">
              <TranslatableText 
                text={processingStage || "Processing your request..."} 
                forceTranslate={true} 
              />
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;
