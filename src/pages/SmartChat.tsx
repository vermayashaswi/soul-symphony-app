import { useEffect, useState, useRef } from "react";
import { SmartChatInterface } from "@/components/chat/SmartChatInterface";
import MobileChatInterface from "@/components/chat/mobile/MobileChatInterface";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { useMentalHealthInsights } from "@/hooks/use-mental-health-insights";
import { Trash2, Plus } from "lucide-react";
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
import { useChatRealtime } from "@/hooks/use-chat-realtime";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TranslatableText } from "@/components/translation/TranslatableText";

const THREAD_ID_STORAGE_KEY = "lastActiveChatThreadId";

export default function SmartChat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries(user?.id, 0, true);
  const navigate = useNavigate();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const previousThreadIdRef = useRef<string | null>(null);
  const titleGeneratedForThreads = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef<boolean>(false);
  const threadCheckInProgressRef = useRef<boolean>(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldRenderMobile = isMobile || mobileDemo;

  // Add mental health insights
  const { insights: mentalHealthInsights } = useMentalHealthInsights(user?.id);

  // Use the realtime hook to track processing status
  const {
    isProcessing,
    processingStatus
  } = useChatRealtime(currentThreadId);

  // Check if deletion should be disabled
  const isDeletionDisabled = isProcessing || processingStatus === 'processing';

  useEffect(() => {
    document.title = "Roha | SOULo";
    
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    const checkOrCreateThread = async () => {
      if (!user?.id || threadCheckInProgressRef.current || hasInitializedRef.current) return;
      
      threadCheckInProgressRef.current = true;
      
      try {
        const lastActiveThreadId = localStorage.getItem(THREAD_ID_STORAGE_KEY);
        
        if (lastActiveThreadId) {
          try {
            const { data, error } = await supabase
              .from('chat_threads')
              .select('id')
              .eq('id', lastActiveThreadId)
              .eq('user_id', user.id)
              .single();
              
            if (data && !error) {
              console.log("Found stored thread ID:", lastActiveThreadId);
              setCurrentThreadId(lastActiveThreadId);
              previousThreadIdRef.current = lastActiveThreadId;
              window.dispatchEvent(
                new CustomEvent('threadSelected', { 
                  detail: { threadId: lastActiveThreadId } 
                })
              );
              hasInitializedRef.current = true;
              return;
            } else {
              console.log("Stored thread ID not found or not valid:", lastActiveThreadId, error);
              localStorage.removeItem(THREAD_ID_STORAGE_KEY);
            }
          } catch (error) {
            console.error("Error checking thread existence:", error);
          }
        }
        
        try {
          console.log("Looking for most recent thread");
          const { data: threads, error } = await supabase
            .from('chat_threads')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1);

          if (error) throw error;

          if (threads && threads.length > 0) {
            console.log("Found most recent thread:", threads[0].id);
            setCurrentThreadId(threads[0].id);
            previousThreadIdRef.current = threads[0].id;
            localStorage.setItem(THREAD_ID_STORAGE_KEY, threads[0].id);
            window.dispatchEvent(
              new CustomEvent('threadSelected', { 
                detail: { threadId: threads[0].id } 
              })
            );
            hasInitializedRef.current = true;
          } else {
            console.log("No existing threads, creating new one");
            await createNewThread();
            hasInitializedRef.current = true;
          }
        } catch (error) {
          console.error("Error checking threads:", error);
        }
      } finally {
        threadCheckInProgressRef.current = false;
      }
    };

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
    
    if (user?.id && !hasInitializedRef.current && !threadCheckInProgressRef.current) {
      checkOrCreateThread();
    }
    
    return () => {
      window.removeEventListener('closeChatSidebar', handleCloseSidebar);
      window.removeEventListener('messageCreated' as any, handleMessageCreated);
    };
  }, [isMobile, mobileDemo, user]);
  
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
      previousThreadIdRef.current = newThreadId;
      localStorage.setItem(THREAD_ID_STORAGE_KEY, newThreadId);
      
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
    localStorage.setItem(THREAD_ID_STORAGE_KEY, threadId);
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

    // Prevent deletion if currently processing
    if (isProcessing || processingStatus === 'processing') {
      toast({
        title: "Cannot delete conversation",
        description: "Please wait for the current request to complete before deleting this conversation.",
        variant: "destructive"
      });
      setShowDeleteDialog(false);
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
        localStorage.setItem(THREAD_ID_STORAGE_KEY, threads[0].id);
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`${
                        isDeletionDisabled 
                          ? 'text-muted-foreground/50 cursor-not-allowed' 
                          : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20'
                      }`}
                      onClick={() => !isDeletionDisabled && setShowDeleteDialog(true)}
                      disabled={isDeletionDisabled}
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isDeletionDisabled ? (
                      <TranslatableText text="Cannot delete while processing" />
                    ) : (
                      <TranslatableText text="Delete conversation" />
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          <SmartChatInterface 
            mentalHealthInsights={mentalHealthInsights} 
          />
        </div>
      </motion.div>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><TranslatableText text="Delete this conversation?" /></AlertDialogTitle>
            <AlertDialogDescription>
              {isDeletionDisabled ? (
                <TranslatableText text="Cannot delete conversation while the chatbot is processing a request. Please wait for the current request to complete." />
              ) : (
                <TranslatableText text="This will permanently delete this conversation and all its messages. This action cannot be undone." />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><TranslatableText text="Cancel" /></AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCurrentThread}
              disabled={isDeletionDisabled}
              className={`${
                isDeletionDisabled 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }`}
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
  
  return (
    <DebugProvider>
      {mobileDemo ? <MobilePreviewFrame>{content}</MobilePreviewFrame> : content}
    </DebugProvider>
  );
}
