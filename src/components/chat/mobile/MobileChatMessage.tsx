
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import ReferencesDisplay from "../ReferencesDisplay";
import AnalyticsDisplay from "../AnalyticsDisplay";
import { ChatMessage } from "@/types/chat";

interface MobileChatMessageProps {
  message: ChatMessage;
  isLoading?: boolean;
}

const MobileChatMessage: React.FC<MobileChatMessageProps> = ({ 
  message, 
  isLoading = false 
}) => {
  const isUser = message.sender === 'user' || message.role === 'user';
  
  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      } mb-4`}
    >
      <div
        className={`flex gap-2 max-w-[85%] ${
          isUser ? "flex-row-reverse" : ""
        }`}
      >
        <Avatar className="h-8 w-8 mt-1">
          {isUser ? (
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
            isUser
              ? "bg-primary text-primary-foreground"
              : message.sender === "error"
              ? "bg-destructive/10 border-destructive/30"
              : ""
          } overflow-hidden`}
        >
          <CardContent className="p-3 prose-sm dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>

            {/* References */}
            {message.reference_entries && message.reference_entries.length > 0 && (
              <ReferencesDisplay 
                references={message.reference_entries} 
                threadId={message.thread_id}
              />
            )}

            {/* Analytics Display */}
            {message.analysis_data && message.has_numeric_result && (
              <AnalyticsDisplay analysisData={message.analysis_data} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileChatMessage;
