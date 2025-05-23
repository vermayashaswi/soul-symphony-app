
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createThread, getThreadMessages, getUserChatThreads } from '@/services/chat';
import { sendMessage } from '@/services/chat/messageService';
import MobileChatMessage from './MobileChatMessage';
import MobileChatInput from './MobileChatInput';
import { ChatMessage } from '@/types/chat';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { List, Loader2, Trash } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { supabase } from '@/integrations/supabase/client';
import { ChatThreadList } from '../ChatThreadList';
import EmptyChatState from '../EmptyChatState';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
    if (!message.trim() || !activeThreadId || !user?.id || isSending) return;
    
    try {
      setIsSending(true);
      
      // Use the proper sendMessage service from messageService
      const response = await sendMessage(message, user.id, activeThreadId);
      
      if (response.status === 'error') {
        toast({
          title: "Error",
          description: response.error || "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
      
      // Messages will be updated via the real-time subscription
      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
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

  const handleDeleteCurrentThread = async () => {
    if (!activeThreadId || !user?.id) {
      toast({
        title: "Error",
        description: "No active conversation to delete",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', activeThreadId);
      
      if (messagesError) {
        console.error("[Mobile] Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', activeThreadId);
      
      if (threadError) {
        console.error("[Mobile] Error deleting thread:", threadError);
        throw threadError;
      }

      setMessages([]);

      // Fetch the most recent thread for this user, after deletion
      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (threads && threads.length > 0) {
        const nextThreadId = threads[0].id;
        setActiveThreadId(nextThreadId);
        navigate(`/app/smart-chat/${nextThreadId}`, { replace: true });
        
        // Load messages for the next thread
        const threadMessages = await getThreadMessages(nextThreadId);
        setMessages(threadMessages);
      } else {
        // Create a new thread if none remain
        const newThreadId = await createThread(user.id);
        if (newThreadId) {
          setActiveThreadId(newThreadId);
          navigate(`/app/smart-chat/${newThreadId}`, { replace: true });
        }
      }

      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("[Mobile] Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
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
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setShowDeleteDialog(true)}
          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash className="h-5 w-5" />
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
          <EmptyChatState onSuggestionClick={handleSuggestionClick} />
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
      
      {/* Delete conversation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><TranslatableText text="Delete this conversation?" /></AlertDialogTitle>
            <AlertDialogDescription>
              <TranslatableText text="This will permanently delete this conversation and all its messages. This action cannot be undone." />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><TranslatableText text="Cancel" /></AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCurrentThread}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <TranslatableText text="Delete" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
