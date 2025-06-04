
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Bot, User, Menu, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getThreadMessages } from '@/services/chat/messageService';
import { ServiceChatMessage } from '@/services/chat/types';
import { ChatThreadList } from "@/components/chat/ChatThreadList";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
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
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !userId || isLoading || isProcessing) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
        
        <div className="w-10" /> {/* Spacer for balance */}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Start a conversation with SOULo" />
            </h3>
            <p className="text-sm">
              <TranslatableText text="Ask me about your journal entries, emotions, or get mental health insights!" />
            </p>
          </div>
        ) : (
          messages.map((message) => (
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
          ))
        )}
        
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

      {/* Input Area */}
      <div className="border-t p-4 bg-background">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about your journal entries..."
            className="min-h-[50px] resize-none text-sm"
            disabled={isLoading || isProcessing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || isProcessing}
            size="sm"
          >
            {isLoading || isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground text-center">
          <TranslatableText text="Personalized insights from your journal" />
        </div>
      </div>
    </div>
  );
};

export default MobileChatInterface;
