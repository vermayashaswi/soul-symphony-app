import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createThread, getThreadMessages, getUserChatThreads } from '@/services/chat';
import MobileChatMessage from './MobileChatMessage';
import MobileChatInput from './MobileChatInput';
import { ChatMessage } from '@/types/chat';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, List, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { supabase } from '@/integrations/supabase/client';
import { ChatThreadList } from '../ChatThreadList';
import EmptyChatState from '../EmptyChatState';

export default function MobileChatInterface() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/app/auth');
      return;
    }

    // Get thread ID from URL or create a new thread
    async function initializeChat() {
      try {
        setLoading(true);
        let currentThreadId = threadId;
        
        // Get user's threads
        const userThreads = await getUserChatThreads(user.id);
        if (userThreads) {
          setThreads(userThreads);
          
          // If no specific thread is specified but user has threads, use the most recent one
          if (!currentThreadId && userThreads.length > 0) {
            currentThreadId = userThreads[0].id;
            navigate(`/app/smart-chat/${currentThreadId}`, { replace: true });
          }
        }
        
        // If still no thread ID, create a new thread
        if (!currentThreadId) {
          const newThreadId = await createThread(user.id);
          if (newThreadId) {
            currentThreadId = newThreadId;
            navigate(`/app/smart-chat/${newThreadId}`, { replace: true });
            
            // Refresh threads list
            const updatedThreads = await getUserChatThreads(user.id);
            if (updatedThreads) {
              setThreads(updatedThreads);
            }
          } else {
            toast({
              title: "Error",
              description: "Failed to create a new chat thread.",
              variant: "destructive",
            });
            return;
          }
        }
        
        setActiveThreadId(currentThreadId);
        
        // Load messages for the current thread
        if (currentThreadId) {
          const threadMessages = await getThreadMessages(currentThreadId);
          setMessages(threadMessages);
        }
      } catch (error) {
        console.error("Error initializing chat:", error);
        toast({
          title: "Error loading messages",
          description: "Could not load conversation history.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    
    initializeChat();

    // Set up real-time subscription for new messages
    if (user?.id) {
      const messageSubscription = supabase
        .channel('chat-messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: threadId ? `thread_id=eq.${threadId}` : undefined,
          },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              // Refresh messages on change
              if (activeThreadId) {
                getThreadMessages(activeThreadId).then(setMessages);
              }
            }
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(messageSubscription);
      };
    }
  }, [user, navigate, threadId, toast]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = async (message: string) => {
    try {
      if (!activeThreadId || !user?.id || !message.trim()) return;
      
      setIsSending(true);
      
      // The actual message sending is handled by the ChatInput component
      // This is just a UI state handler
      setIsSending(false);
      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setIsSending(false);
    }
  };
  
  // Creates a new chat thread and navigates to it
  const handleCreateNewThread = async () => {
    try {
      if (!user?.id) return null;
      
      const newThreadId = await createThread(user.id);
      if (newThreadId) {
        navigate(`/app/smart-chat/${newThreadId}`);
        setSidebarOpen(false);
        
        // Refresh threads list
        const updatedThreads = await getUserChatThreads(user.id);
        if (updatedThreads) {
          setThreads(updatedThreads);
        }
        
        return newThreadId;
      }
      return null;
    } catch (error) {
      console.error("Error creating new thread:", error);
      toast({
        title: "Error",
        description: "Failed to create a new chat thread.",
        variant: "destructive",
      });
      return null;
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Mobile header */}
      <div className="flex justify-between items-center border-b p-2 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <List className="h-5 w-5" />
        </Button>
        <h1 className="text-md font-medium">
          <TranslatableText text="Chat" />
        </h1>
        <Button variant="ghost" size="icon" onClick={handleCreateNewThread}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Sidebar/Sheet for thread list */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[85%] sm:w-[385px]">
          <SheetHeader className="sheet-header">
            <SheetTitle><TranslatableText text="Conversations" /></SheetTitle>
          </SheetHeader>
          <div className="mt-5">
            <ChatThreadList
              activeThreadId={activeThreadId}
              onSelectThread={(threadId) => {
                navigate(`/app/smart-chat/${threadId}`);
                setSidebarOpen(false);
              }}
              onCreateThread={handleCreateNewThread}
            />
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Chat content area */}
      <div className="flex-1 overflow-auto p-4 chat-messages-container">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyChatState />
        ) : (
          <>
            {messages.map((msg) => (
              <MobileChatMessage
                key={msg.id}
                message={msg}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Chat input area - fixed at bottom */}
      <div className="sticky bottom-0 mobile-chat-input-container">
        <MobileChatInput
          onSendMessage={handleSendMessage}
          isLoading={loading || isSending}
          userId={user?.id}
        />
      </div>
    </div>
  );
}
