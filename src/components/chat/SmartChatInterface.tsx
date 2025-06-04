
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getThreadMessages } from '@/services/chat/messageService';
import { ServiceChatMessage } from '@/services/chat/types';
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import ReferencesDisplay from "./ReferencesDisplay";
import ChatWelcomeSection from "./ChatWelcomeSection";
import ChatInputArea from "./ChatInputArea";
import { Loader2 } from "lucide-react";

interface SmartChatInterfaceProps {
  mentalHealthInsights?: any;
  currentThreadId?: string | null;
  onNewThread?: () => Promise<string | null>;
}

export function SmartChatInterface({ 
  mentalHealthInsights, 
  currentThreadId,
  onNewThread 
}: SmartChatInterfaceProps) {
  const [messages, setMessages] = useState<ServiceChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(currentThreadId || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Use realtime hook for processing status
  const { isProcessing } = useChatRealtime(threadId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentThreadId) {
      setThreadId(currentThreadId);
      loadMessages(currentThreadId);
    }
  }, [currentThreadId]);

  useEffect(() => {
    const handleThreadSelected = (event: CustomEvent) => {
      const { threadId: selectedThreadId } = event.detail;
      setThreadId(selectedThreadId);
      loadMessages(selectedThreadId);
    };

    window.addEventListener('threadSelected' as any, handleThreadSelected);
    return () => window.removeEventListener('threadSelected' as any, handleThreadSelected);
  }, []);

  const loadMessages = async (threadId: string) => {
    try {
      const threadMessages = await getThreadMessages(threadId);
      setMessages(threadMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation history",
        variant: "destructive"
      });
    }
  };

  const buildConversationContext = useCallback(() => {
    return messages.slice(-6).map(msg => ({
      role: msg.role || (msg.sender === 'user' ? 'user' : 'assistant'),
      content: msg.content,
      timestamp: msg.created_at,
      analysis: msg.analysis_data
    }));
  }, [messages]);

  const handleSendMessage = async (messageText: string) => {
    if (!user?.id || isLoading || isProcessing) return;

    setIsLoading(true);

    try {
      const conversationContext = buildConversationContext();
      
      const result = await sendMessage(
        messageText,
        threadId,
        user.id,
        conversationContext
      );

      if (result.success && result.message) {
        // Update current thread ID if a new thread was created
        if (result.threadId && result.threadId !== threadId) {
          setThreadId(result.threadId);
          if (onNewThread) {
            onNewThread();
          }
        }

        // Reload messages to get the latest conversation
        if (threadId || result.threadId) {
          await loadMessages(result.threadId || threadId!);
        }

        // Dispatch events for thread management
        window.dispatchEvent(
          new CustomEvent('messageCreated', {
            detail: {
              threadId: result.threadId || threadId,
              messageId: result.message.id,
              isFirstMessage: messages.length === 0
            }
          })
        );

        toast({
          title: "Success",
          description: "Message sent successfully",
        });
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <ChatWelcomeSection onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="p-4 space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`max-w-[80%] p-4 ${
                  message.sender === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <div className="flex items-start gap-3">
                    {message.sender === 'assistant' && (
                      <Bot className="h-5 w-5 mt-1 flex-shrink-0" />
                    )}
                    {message.sender === 'user' && (
                      <User className="h-5 w-5 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="prose prose-sm max-w-none">
                        {formatMessage(message.content)}
                      </div>
                      {message.analysis_data?.pipeline === 'intelligent' && (
                        <div className="mt-2 text-xs opacity-70">
                          <TranslatableText text="Powered by Intelligent RAG Pipeline" />
                        </div>
                      )}
                      
                      {message.sender === 'assistant' && message.analysis_data?.references && (
                        <ReferencesDisplay 
                          references={message.analysis_data.references}
                          threadId={threadId}
                        />
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            ))}
            
            {(isLoading || isProcessing) && (
              <div className="flex justify-start">
                <Card className="max-w-[80%] p-4 bg-muted">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5" />
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        <TranslatableText text="SOULo is thinking..." />
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <ChatInputArea
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        isProcessing={isProcessing}
      />
    </div>
  );
}

export default SmartChatInterface;
