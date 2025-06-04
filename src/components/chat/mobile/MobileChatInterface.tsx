
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, User, Menu, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getThreadMessages } from '@/services/chat/messageService';
import { ServiceChatMessage } from '@/services/chat/types';
import { ChatThreadList } from "@/components/chat/ChatThreadList";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import ChatWelcomeSection from "../ChatWelcomeSection";
import ChatHeader from "../ChatHeader";
import ChatInputArea from "../ChatInputArea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileChatInterfaceProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId?: string;
  mentalHealthInsights?: any;
}

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights
}) => {
  const [messages, setMessages] = useState<ServiceChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Use realtime hook for processing status
  const { isProcessing } = useChatRealtime(currentThreadId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentThreadId) {
      loadMessages(currentThreadId);
    } else {
      setMessages([]);
    }
  }, [currentThreadId]);

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
    if (!userId || isLoading || isProcessing) return;

    setIsLoading(true);

    try {
      const conversationContext = buildConversationContext();
      
      const result = await sendMessage(
        messageText,
        currentThreadId,
        userId,
        conversationContext
      );

      if (result.success && result.message) {
        // Update current thread ID if a new thread was created
        if (result.threadId && result.threadId !== currentThreadId) {
          onSelectThread(result.threadId);
        }

        // Reload messages to get the latest conversation
        if (currentThreadId || result.threadId) {
          await loadMessages(result.threadId || currentThreadId!);
        }

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

  const handleCreateNewThread = async () => {
    const newThreadId = await onCreateNewThread();
    if (newThreadId) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header with Menu */}
      <div className="border-b p-4 bg-background flex items-center justify-between">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <div className="p-4 border-b">
              <Button
                onClick={handleCreateNewThread}
                className="w-full"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                <TranslatableText text="New Conversation" />
              </Button>
            </div>
            <ChatThreadList
              activeThreadId={currentThreadId}
              onSelectThread={(threadId) => {
                onSelectThread(threadId);
                setSidebarOpen(false);
              }}
              onCreateThread={handleCreateNewThread}
            />
          </SheetContent>
        </Sheet>
        
        <h1 className="text-lg font-semibold">
          <TranslatableText text="SOULo Chat" />
        </h1>
        
        <div className="w-10" />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full px-4 pt-8">
            <ChatWelcomeSection onSuggestionClick={handleSuggestionClick} />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`max-w-[85%] p-3 ${
                  message.sender === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <div className="flex items-start gap-2">
                    {message.sender === 'assistant' && (
                      <Bot className="h-4 w-4 mt-1 flex-shrink-0" />
                    )}
                    {message.sender === 'user' && (
                      <User className="h-4 w-4 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm">
                        {formatMessage(message.content)}
                      </div>
                      {message.analysis_data?.pipeline === 'intelligent' && (
                        <div className="mt-1 text-xs opacity-70">
                          <TranslatableText text="Intelligent RAG" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            ))}
            
            {(isLoading || isProcessing) && (
              <div className="flex justify-start">
                <Card className="max-w-[85%] p-3 bg-muted">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
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
        placeholder="Ask me about your journal entries..."
      />
    </div>
  );
};

export default MobileChatInterface;
