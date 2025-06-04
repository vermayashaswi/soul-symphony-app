
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Loader2, Bot, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getThreadMessages } from '@/services/chat/messageService';
import { ServiceChatMessage } from '@/services/chat/types';
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useChatRealtime } from "@/hooks/use-chat-realtime";

interface SmartChatInterfaceProps {
  mentalHealthInsights?: any;
}

export function SmartChatInterface({ mentalHealthInsights }: SmartChatInterfaceProps) {
  const [messages, setMessages] = useState<ServiceChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
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
    const handleThreadSelected = (event: CustomEvent) => {
      const { threadId } = event.detail;
      setCurrentThreadId(threadId);
      loadMessages(threadId);
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user?.id || isLoading || isProcessing) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      const conversationContext = buildConversationContext();
      
      const result = await sendMessage(
        messageText,
        currentThreadId,
        user.id,
        conversationContext
      );

      if (result.success && result.message) {
        // Update current thread ID if a new thread was created
        if (result.threadId && result.threadId !== currentThreadId) {
          setCurrentThreadId(result.threadId);
        }

        // Reload messages to get the latest conversation
        if (currentThreadId || result.threadId) {
          await loadMessages(result.threadId || currentThreadId!);
        }

        // Dispatch events for thread management
        window.dispatchEvent(
          new CustomEvent('messageCreated', {
            detail: {
              threadId: result.threadId || currentThreadId,
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

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl mx-auto">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">
              <TranslatableText text="Start a conversation with SOULo" />
            </h3>
            <p>
              <TranslatableText text="Ask me about your journal entries, emotions, or get mental health insights!" />
            </p>
          </div>
        ) : (
          messages.map((message) => (
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
                  </div>
                </div>
              </Card>
            </div>
          ))
        )}
        
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

      {/* Input Area */}
      <div className="border-t p-4 bg-background">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about your journal entries or mental health..."
            className="min-h-[60px] resize-none"
            disabled={isLoading || isProcessing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || isProcessing}
            size="lg"
            className="px-6"
          >
            {isLoading || isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground text-center">
          <TranslatableText text="SOULo uses your journal entries to provide personalized insights" />
        </div>
      </div>
    </div>
  );
}
