import { useEffect, useState, useRef } from "react";
import { SmartChatInterface } from "@/components/chat/SmartChatInterface";
import MobileChatInterface from "@/components/chat/mobile/MobileChatInterface";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { useMentalHealthInsights } from "@/hooks/use-mental-health-insights";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import MobilePreviewFrame from "@/components/MobilePreviewFrame";
import { ChatThreadList } from "@/components/chat/ChatThreadList";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import { generateThreadTitle } from "@/utils/chat/threadUtils";
import { useToast } from "@/hooks/use-toast";
import { DebugProvider } from "@/utils/debug/DebugContext";
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
import { TranslatableText } from "@/components/translation/TranslatableText";

const THREAD_ID_STORAGE_KEY = "lastActiveChatThreadId";
const INITIALIZATION_TIMEOUT = 10000; // 10 seconds timeout

export default function SmartChat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries(user?.id, 0, true);
  const navigate = useNavigate();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const previousThreadIdRef = useRef<string | null>(null);
  const titleGeneratedForThreads = useRef<Set<string>>(new Set());
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationAttemptedRef = useRef(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldRenderMobile = isMobile || mobileDemo;

  // Add mental health insights
  const { insights: mentalHealthInsights } = useMentalHealthInsights(user?.id);

  useEffect(() => {
    document.title = "Roha | SOULo";
    
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
  }, []);

  // Simplified initialization with timeout and error handling
  useEffect(() => {
    if (!user?.id || initializationAttemptedRef.current) return;

    initializationAttemptedRef.current = true;
    console.log('SmartChat: Starting initialization for user:', user.id);
    
    const initializeWithTimeout = async () => {
      try {
        setIsInitializing(true);
        setInitializationError(null);

        // Set up timeout
        initializationTimeoutRef.current = setTimeout(() => {
          console.warn('SmartChat: Initialization timeout reached, forcing fallback');
          handleInitializationFallback();
        }, INITIALIZATION_TIMEOUT);

        const success = await attemptInitialization();
        
        if (success) {
          console.log('SmartChat: Initialization successful');
          clearTimeout(initializationTimeoutRef.current!);
          setIsInitializing(false);
        } else {
          throw new Error('Initialization failed');
        }
      } catch (error) {
        console.error('SmartChat: Initialization error:', error);
        handleInitializationFallback();
      }
    };

    initializeWithTimeout();

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    };
  }, [user?.id]);

  const attemptInitialization = async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Try to use stored thread first
      const lastActiveThreadId = localStorage.getItem(THREAD_ID_STORAGE_KEY);
      
      if (lastActiveThreadId) {
        console.log('SmartChat: Checking stored thread:', lastActiveThreadId);
        const { data, error } = await Promise.race([
          supabase
            .from('chat_threads')
            .select('id')
            .eq('id', lastActiveThreadId)
            .eq('user_id', user.id)
            .single(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 5000))
        ]);
        
        if (data && !error) {
          console.log('SmartChat: Using stored thread:', lastActiveThreadId);
          setCurrentThreadId(lastActiveThreadId);
          dispatchThreadSelectedEvent(lastActiveThreadId);
          return true;
        } else {
          localStorage.removeItem(THREAD_ID_STORAGE_KEY);
        }
      }

      // Find most recent thread
      console.log('SmartChat: Looking for recent threads');
      const { data: threads, error } = await Promise.race([
        supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 5000))
      ]);

      if (error) throw error;

      if (threads && threads.length > 0) {
        console.log('SmartChat: Using most recent thread:', threads[0].id);
        const threadId = threads[0].id;
        setCurrentThreadId(threadId);
        localStorage.setItem(THREAD_ID_STORAGE_KEY, threadId);
        dispatchThreadSelectedEvent(threadId);
        return true;
      } else {
        console.log('SmartChat: No threads found, creating new one');
        const newThreadId = await createNewThreadInternal();
        return !!newThreadId;
      }
    } catch (error) {
      console.error('SmartChat: Attempt initialization failed:', error);
      return false;
    }
  };

  const handleInitializationFallback = async () => {
    console.log('SmartChat: Running fallback initialization');
    try {
      const newThreadId = await createNewThreadInternal();
      if (newThreadId) {
        setCurrentThreadId(newThreadId);
        localStorage.setItem(THREAD_ID_STORAGE_KEY, newThreadId);
        dispatchThreadSelectedEvent(newThreadId);
      } else {
        setInitializationError('Failed to create conversation. Please refresh the page.');
      }
    } catch (error) {
      console.error('SmartChat: Fallback initialization failed:', error);
      setInitializationError('Failed to initialize chat. Please refresh the page.');
    } finally {
      setIsInitializing(false);
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    }
  };

  const dispatchThreadSelectedEvent = (threadId: string) => {
    window.dispatchEvent(
      new CustomEvent('threadSelected', { 
        detail: { threadId } 
      })
    );
  };

  const createNewThreadInternal = async (): Promise<string | null> => {
    if (!user?.id) return null;
    
    try {
      console.log("SmartChat: Creating new thread");
      const newThreadId = uuidv4();
      const { error } = await supabase
        .from('chat_threads')
        .insert({
          id: newThreadId,
          user_id: user.id,
          title: "New Conversation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      console.log("SmartChat: Created new thread:", newThreadId);
      return newThreadId;
    } catch (error) {
      console.error("SmartChat: Error creating thread:", error);
      return null;
    }
  };

  useEffect(() => {
    const generateTitleForPreviousThread = async () => {
      if (previousThreadIdRef.current && 
          previousThreadIdRef.current !== currentThreadId &&
          user?.id) {
        
        if (!titleGeneratedForThreads.current.has(previousThreadIdRef.current)) {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('count')
            .eq('thread_id', previousThreadIdRef.current);
          
          if (!error && data && data.length > 0) {
            console.log("Generating title for thread being left:", previousThreadIdRef.current);
            const title = await generateThreadTitle(previousThreadIdRef.current, user?.id);
            
            if (title) {
              titleGeneratedForThreads.current.add(previousThreadIdRef.current);
              window.dispatchEvent(
                new CustomEvent('threadTitleUpdated', { 
                  detail: { threadId: previousThreadIdRef.current, title } 
                })
              );
            }
          }
        }
        
        previousThreadIdRef.current = currentThreadId;
      }
    };
    
    generateTitleForPreviousThread();
  }, [currentThreadId, user?.id]);

  const createNewThread = async (): Promise<string | null> => {
    if (!user?.id) return null;
    
    try {
      console.log("Creating new thread");
      const newThreadId = uuidv4();
      const { error } = await supabase
        .from('chat_threads')
        .insert({
          id: newThreadId,
          user_id: user.id,
          title: "New Conversation",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      console.log("Created new thread:", newThreadId);
      setCurrentThreadId(newThreadId);
      localStorage.setItem("lastActiveChatThreadId", newThreadId);
      
      window.dispatchEvent(
        new CustomEvent('threadSelected', { 
          detail: { threadId: newThreadId } 
        })
      );
      
      return newThreadId;
    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
      return null;
    }
  };

  const handleSelectThread = (threadId: string) => {
    console.log("Thread selected:", threadId);
    setCurrentThreadId(threadId);
    localStorage.setItem("lastActiveChatThreadId", threadId);
    window.dispatchEvent(
      new CustomEvent('threadSelected', { 
        detail: { threadId: threadId } 
      })
    );
  };

  const handleDeleteCurrentThread = async () => {
    if (!currentThreadId || !user?.id) {
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
        .eq('thread_id', currentThreadId);
      
      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThreadId);
      
      if (threadError) {
        console.error("Error deleting thread:", threadError);
        throw threadError;
      }

      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (threads && threads.length > 0) {
        setCurrentThreadId(threads[0].id);
        previousThreadIdRef.current = threads[0].id;
        localStorage.setItem("lastActiveChatThreadId", threads[0].id);
        window.dispatchEvent(
          new CustomEvent('threadSelected', { 
            detail: { threadId: threads[0].id } 
          })
        );
      } else {
        await createNewThread();
      }

      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
      
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const handleCloseSidebar = () => {
      setShowSidebar(false);
    };
    
    const handleMessageCreated = async (event: CustomEvent) => {
      if (event.detail?.threadId && event.detail?.isFirstMessage) {
        setTimeout(async () => {
          const title = await generateThreadTitle(event.detail.threadId, user?.id);
          if (title) {
            titleGeneratedForThreads.current.add(event.detail.threadId);
            window.dispatchEvent(
              new CustomEvent('threadTitleUpdated', { 
                detail: { threadId: event.detail.threadId, title } 
              })
            );
          }
        }, 1000);
      }
    };
    
    window.addEventListener('closeChatSidebar', handleCloseSidebar);
    window.addEventListener('messageCreated' as any, handleMessageCreated);
    
    return () => {
      window.removeEventListener('closeChatSidebar', handleCloseSidebar);
      window.removeEventListener('messageCreated' as any, handleMessageCreated);
    };
  }, [user]);

  const desktopContent = (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="smart-chat-container w-full h-[calc(100vh)] flex"
        ref={chatContainerRef}
      >
        <div className="w-72 h-full border-r">
          <ChatThreadList 
            activeThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onCreateThread={createNewThread}
          />
        </div>
        
        <div className="flex-1 p-4 relative">
          {currentThreadId && (
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                onClick={() => setShowDeleteDialog(true)}
                aria-label="Delete conversation"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          )}
          <SmartChatInterface 
            mentalHealthInsights={mentalHealthInsights}
            currentThreadId={currentThreadId}
          />
        </div>
      </motion.div>
      
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
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <TranslatableText text="Delete" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const mobileContent = (
    <div className="flex flex-col h-full" ref={chatContainerRef}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="smart-chat-container flex-1 flex flex-col"
      >
        <div className="flex-1 flex flex-col">
          <MobileChatInterface 
            currentThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onCreateNewThread={createNewThread}
            userId={user?.id}
            mentalHealthInsights={mentalHealthInsights}
          />
        </div>
      </motion.div>
    </div>
  );
  
  const content = shouldRenderMobile ? mobileContent : desktopContent;
  
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">
            {initializationError ? initializationError : "Initializing chat..."}
          </p>
          {initializationError && (
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
              variant="outline"
            >
              Refresh Page
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <DebugProvider>
      {mobileDemo ? <MobilePreviewFrame>{content}</MobilePreviewFrame> : content}
    </DebugProvider>
  );
}
