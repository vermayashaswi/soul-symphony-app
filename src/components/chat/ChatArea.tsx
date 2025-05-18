
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
import { ChatMessage } from "@/types/chat";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isLoading]);

  return (
    <div className="flex flex-col p-4 overflow-y-auto h-full pb-20">
      {chatMessages.map((message, index) => (
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
            <Avatar className="h-8 w-8">
              {message.sender === "user" || message.role === "user" ? (
                <AvatarFallback className="bg-primary text-primary-foreground">
                  U
                </AvatarFallback>
              ) : (
                <>
                  <AvatarImage src="/images/logo.svg" />
                  <AvatarFallback className="bg-muted">AI</AvatarFallback>
                </>
              )}
            </Avatar>

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
          <div className="flex gap-3 max-w-[80%]">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/images/logo.svg" />
              <AvatarFallback className="bg-muted">AI</AvatarFallback>
            </Avatar>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center">
                  <div className="animate-pulse flex space-x-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground"></div>
                  </div>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {processingStage || <TranslatableText text="Processing..." />}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} className="pb-5" />
    </div>
  );
};

export default ChatArea;
