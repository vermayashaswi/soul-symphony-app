
import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Menu, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ChatThreadList } from "../ChatThreadList";
import MobileChatMessage from "./MobileChatMessage";
import MobileChatInput from "./MobileChatInput";
import EmptyChatState from "../EmptyChatState";
import { getThreadMessages, sendMessage } from "@/services/chat/messageService";
import { TranslatableText } from "@/components/translation/TranslatableText";

interface MobileChatInterfaceProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId: string | undefined;
  mentalHealthInsights?: any;
}

export default function MobileChatInterface({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights,
}: MobileChatInterfaceProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [currentThreadId]);

  const loadMessages = async () => {
    if (!currentThreadId) return;
    
    try {
      console.log(`[MobileChatInterface] Loading messages for thread: ${currentThreadId}`);
      const threadMessages = await getThreadMessages(currentThreadId);
      console.log(`[MobileChatInterface] Loaded ${threadMessages.length} messages`);
      setMessages(threadMessages);
    } catch (error) {
      console.error("[MobileChatInterface] Error loading messages:", error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !user?.id || !currentThreadId || isLoading) return;

    setIsLoading(true);

    try {
      console.log(`[MobileChatInterface] Sending message: ${message}`);
      
      const response = await sendMessage(message, user.id, currentThreadId);
      
      console.log(`[MobileChatInterface] Received response:`, response);
      
      if (response.status === 'success') {
        await loadMessages();
        
        if (messages.length === 0) {
          window.dispatchEvent(
            new CustomEvent('messageCreated', { 
              detail: { threadId: currentThreadId, isFirstMessage: true } 
            })
          );
        }
      } else {
        console.error('[MobileChatInterface] Error in response:', response.error);
      }
    } catch (error) {
      console.error("[MobileChatInterface] Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>
                <TranslatableText text="Conversations" />
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ChatThreadList 
                activeThreadId={currentThreadId}
                onSelectThread={onSelectThread}
                onCreateThread={onCreateNewThread}
              />
            </div>
          </SheetContent>
        </Sheet>
        
        <h1 className="text-lg font-semibold">
          <TranslatableText text="Ruh" />
        </h1>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateNewThread}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col">
        {messages.length === 0 ? (
          <EmptyChatState />
        ) : (
          <ScrollArea ref={scrollAreaRef} className="flex-1">
            <div className="flex flex-col p-4 space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MobileChatMessage message={message} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}
        
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <MobileChatInput 
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
