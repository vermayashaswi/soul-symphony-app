
import React, { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { XIcon, InfoIcon } from "lucide-react";
import ReferencesDisplay from "./ReferencesDisplay";
import { Button } from "@/components/ui/button";
import { TranslatableText } from "@/components/translation/TranslatableText";
import AnalyticsDisplay from "./AnalyticsDisplay";
import EmotionRadarChart from "./EmotionRadarChart";
import TypingIndicator from "./TypingIndicator";
import ParticleAvatar from "./ParticleAvatar";
import { ChatMessage } from "@/types/chat";
import { useAutoScroll } from "@/hooks/use-auto-scroll";

interface ChatAreaProps {
  chatMessages: ChatMessage[];
  isLoading?: boolean;
  processingStage?: string;
  threadId?: string | null;
  onInteractiveOptionClick?: (option: any) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ 
  chatMessages, 
  isLoading, 
  processingStage,
  threadId,
  onInteractiveOptionClick
}) => {
  // Use unified auto-scroll hook
  const { scrollElementRef, scrollToBottom } = useAutoScroll({
    dependencies: [chatMessages, isLoading, processingStage],
    delay: 50,
    scrollThreshold: 100
  });

  // Enhanced logging to ensure context is being passed properly
  useEffect(() => {
    if (chatMessages.length > 0) {
      console.log(`ChatArea: Rendering ${chatMessages.length} messages`);
      console.log("Last message:", chatMessages[chatMessages.length - 1]?.content.substring(0, 50) + "...");
      
      // Enhanced context logging for better debugging
      if (threadId) {
        const lastUserQuestion = chatMessages
          .filter(msg => msg.sender === 'user' || msg.role === 'user')
          .slice(-1)[0]?.content;
          
        console.log("Last user question:", lastUserQuestion);
        
        // Log the full thread conversation for context analysis
        console.log("Full conversation context for analysis:", 
          chatMessages.map(msg => `[${msg.sender || msg.role}]: ${msg.content.substring(0, 30)}...`));
      }
    }
  }, [chatMessages, threadId]);

  // Listen for global force-scroll events (e.g., after user presses Send)
  useEffect(() => {
    const handleForceScroll = () => {
      // Force scroll regardless of user's current position
      scrollToBottom(true);
    };
    window.addEventListener('chat:forceScrollToBottom' as any, handleForceScroll);
    // Backward-compatible alias if needed in future
    window.addEventListener('chat:scrollToBottom' as any, handleForceScroll);
    return () => {
      window.removeEventListener('chat:forceScrollToBottom' as any, handleForceScroll);
      window.removeEventListener('chat:scrollToBottom' as any, handleForceScroll);
    };
  }, [scrollToBottom]);

  return (
    <div ref={scrollElementRef} className="flex flex-col p-4 overflow-y-auto h-full pb-20">
      {chatMessages.filter(msg => !msg.is_processing).map((message, index) => (
        <div
          key={index}
          className={`flex ${
            message.sender === "user" || message.role === "user"
              ? "justify-end"
              : "justify-start"
          } mb-4`}
        >
          <div
            className={`flex gap-3 max-w-[80%] ${
              message.sender === "user" || message.role === "user"
                ? "flex-row-reverse"
                : ""
            }`}
          >
            <div className="mt-1">
              {message.sender === "user" || message.role === "user" ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage 
                    src={undefined} 
                    alt="User"
                    className="bg-primary/20"
                    loading="eager"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    U
                  </AvatarFallback>
                </Avatar>
              ) : (
                <ParticleAvatar className="h-8 w-8" size={32} />
              )}
            </div>

            <Card
              className={`${
                message.sender === "user" || message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : message.sender === "error" || message.role === "error"
                  ? "bg-destructive/10 border-destructive/50"
                  : ""
              } overflow-hidden`}
            >
              <CardContent className="p-3">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                  
                  {/* Interactive Options */}
                  {message.isInteractive && message.interactiveOptions && onInteractiveOptionClick && (
                    <div className="mt-4 flex flex-col gap-2">
                      {message.interactiveOptions.map((option, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          className="text-left justify-start"
                          onClick={() => onInteractiveOptionClick(option)}
                          data-test-id={`interactive-option-${idx}`}
                        >
                          {option.text}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* References */}
                  {message.reference_entries && Array.isArray(message.reference_entries) && message.reference_entries.length > 0 && (
                    <ReferencesDisplay 
                      references={message.reference_entries} 
                      threadId={threadId || undefined}
                    />
                  )}

                  {/* Analytics Display for analysis data */}
                  {message.analysis_data && message.has_numeric_result && (
                    <AnalyticsDisplay analysisData={message.analysis_data} />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start mb-4">
          <TypingIndicator />
        </div>
      )}

      <div className="pb-5" />
    </div>
  );
};

export default ChatArea;
