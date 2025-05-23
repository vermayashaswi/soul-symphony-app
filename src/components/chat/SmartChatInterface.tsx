import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getThreadMessages, sendMessage } from "@/services/chat/messageService";
import ChatMessage from "./ChatMessage";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface SmartChatInterfaceProps {
  mentalHealthInsights?: any;
}

export function SmartChatInterface({ mentalHealthInsights }: SmartChatInterfaceProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleThreadSelected = (event: CustomEvent) => {
      setCurrentThreadId(event.detail.threadId);
    };

    window.addEventListener('threadSelected' as any, handleThreadSelected);

    return () => {
      window.removeEventListener('threadSelected' as any, handleThreadSelected);
    };
  }, []);

  useEffect(() => {
    loadMessages();
  }, [currentThreadId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!input.trim() || !user?.id || !currentThreadId || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      console.log(`[SmartChatInterface] Sending message: ${userMessage}`);
      
      // Use the consolidated messageService
      const response = await sendMessage(userMessage, user.id, currentThreadId);
      
      console.log(`[SmartChatInterface] Received response:`, response);
      
      if (response.status === 'success') {
        // Refresh messages to get the latest conversation
        await loadMessages();
        
        // Dispatch event for title generation if this is the first exchange
        if (messages.length === 0) {
          window.dispatchEvent(
            new CustomEvent('messageCreated', { 
              detail: { threadId: currentThreadId, isFirstMessage: true } 
            })
          );
        }
      } else {
        console.error('[SmartChatInterface] Error in response:', response.error);
        toast.error(response.error || "Failed to send message");
      }
    } catch (error) {
      console.error("[SmartChatInterface] Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!currentThreadId) return;
    
    try {
      console.log(`[SmartChatInterface] Loading messages for thread: ${currentThreadId}`);
      const threadMessages = await getThreadMessages(currentThreadId);
      console.log(`[SmartChatInterface] Loaded ${threadMessages.length} messages`);
      setMessages(threadMessages);
    } catch (error) {
      console.error("[SmartChatInterface] Error loading messages:", error);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <Card className="flex-grow overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full">
          <div className="flex flex-col p-4 space-y-2">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isLast={index === messages.length - 1}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>
      <Card className="m-2">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            className="flex-grow"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading}
            aria-label="Send message"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <TranslatableText text="Sending..." />
              </>
            ) : (
              <>
                <TranslatableText text="Send" />
                <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </Card>
  );
}
