import { useEffect, useState, useRef } from "react";
import SmartChatInterface from "@/components/chat/SmartChatInterface";
import MobileChatInterface from "@/components/chat/mobile/MobileChatInterface";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import MobilePreviewFrame from "@/components/MobilePreviewFrame";
import Navbar from "@/components/Navbar";
import ChatThreadList from "@/components/chat/ChatThreadList";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";
import { generateThreadTitle } from "@/utils/chat/threadUtils";
import { useToast } from "@/hooks/use-toast";

const THREAD_ID_STORAGE_KEY = "lastActiveChatThreadId";

export default function SmartChat() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries(user?.id, 0, true);
  const navigate = useNavigate();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const previousThreadIdRef = useRef<string | null>(null);
  const titleGeneratedForThreads = useRef<Set<string>>(new Set());
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldRenderMobile = isMobile || mobileDemo;

  useEffect(() => {
    document.title = "Roha | SOULo";
    
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    const checkOrCreateThread = async () => {
      if (!user?.id) return;
      setIsLoadingThreads(true);

      // Try to get the last active thread from localStorage first
      const lastActiveThreadId = localStorage.getItem(THREAD_ID_STORAGE_KEY);
      
      if (lastActiveThreadId) {
        // Verify this thread exists and belongs to the user
        try {
          const { data, error } = await supabase
            .from('chat_threads')
            .select('id')
            .eq('id', lastActiveThreadId)
            .eq('user_id', user.id)
            .single();
            
          if (data && !error) {
            console.log(`Found existing thread: ${lastActiveThreadId}`);
            setCurrentThreadId(lastActiveThreadId);
            previousThreadIdRef.current = lastActiveThreadId;
            window.dispatchEvent(
              new CustomEvent('threadSelected', { 
                detail: { threadId: lastActiveThreadId } 
              })
            );
            setIsLoadingThreads(false);
            return;
          } else {
            console.log(`Thread ${lastActiveThreadId} not found or doesn't belong to user, fetching most recent thread`);
          }
        } catch (error) {
          console.error("Error checking thread existence:", error);
        }
      }
      
      // If no saved thread ID or it doesn't exist, get the most recent thread
      try {
        const { data: threads, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (threads && threads.length > 0) {
          console.log(`Using most recent thread: ${threads[0].id}`);
          setCurrentThreadId(threads[0].id);
          previousThreadIdRef.current = threads[0].id;
          localStorage.setItem(THREAD_ID_STORAGE_KEY, threads[0].id);
          window.dispatchEvent(
            new CustomEvent('threadSelected', { 
              detail: { threadId: threads[0].id } 
            })
          );
        } else {
          console.log("No existing threads found, creating new thread");
          await createNewThread();
        }
      } catch (error) {
        console.error("Error checking threads:", error);
      } finally {
        setIsLoadingThreads(false);
      }
    };

    const handleCloseSidebar = () => {
      setShowSidebar(false);
    };
    
    // Handle message creation events for title generation of first message only
    const handleMessageCreated = async (event: CustomEvent) => {
      if (event.detail?.threadId && event.detail?.isFirstMessage) {
        // Wait a moment for the first message to be processed
        setTimeout(async () => {
          const title = await generateThreadTitle(event.detail.threadId, user?.id);
          if (title) {
            // Mark this thread as having a generated title
            titleGeneratedForThreads.current.add(event.detail.threadId);
            
            // Dispatch event to update thread title in ChatThreadList
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
    
    checkOrCreateThread();
    
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
        
        // Only generate title if we haven't already done so for this thread
        if (!titleGeneratedForThreads.current.has(previousThreadIdRef.current)) {
          // Check if the thread has messages
          const { data, error } = await supabase
            .from('chat_messages')
            .select('count')
            .eq('thread_id', previousThreadIdRef.current);
          
          if (!error && data && data.length > 0) {
            console.log("Generating title for thread being left:", previousThreadIdRef.current);
            const title = await generateThreadTitle(previousThreadIdRef.current, user?.id);
            
            if (title) {
              // Mark this thread as having a generated title
              titleGeneratedForThreads.current.add(previousThreadIdRef.current);
              
              // Dispatch event to update thread title in ChatThreadList
              window.dispatchEvent(
                new CustomEvent('threadTitleUpdated', { 
                  detail: { threadId: previousThreadIdRef.current, title } 
                })
              );
            }
          }
        }
        
        // Update the previous thread ID
        previousThreadIdRef.current = currentThreadId;
      }
    };
    
    generateTitleForPreviousThread();
  }, [currentThreadId, user?.id]);

  const hasEnoughEntries = !loading && entries.length > 0;

  const createNewThread = async (): Promise<string | null> => {
    if (!user?.id) return null;
    
    try {
      const newThreadId = uuidv4();
      console.log(`Creating new thread with ID: ${newThreadId}`);
      
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
    setCurrentThreadId(threadId);
    localStorage.setItem(THREAD_ID_STORAGE_KEY, threadId);
    window.dispatchEvent(
      new CustomEvent('threadSelected', { 
        detail: { threadId: threadId } 
      })
    );
  };

  const handleThreadDeleted = async (deletedThreadId: string) => {
    if (deletedThreadId !== currentThreadId) {
      // Not the current thread, no need to do anything
      return;
    }
    
    try {
      // Find another thread to switch to
      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(5);
        
      if (error) throw error;
      
      if (threads && threads.length > 0) {
        // Filter out the deleted thread
        const otherThreads = threads.filter(thread => thread.id !== deletedThreadId);
        
        if (otherThreads.length > 0) {
          // Find an empty thread
          for (const thread of otherThreads) {
            const { count, error: countError } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('thread_id', thread.id);
              
            if (!countError && count === 0) {
              // Empty thread found, switch to it
              handleSelectThread(thread.id);
              return;
            }
          }
          
          // No empty threads, just use the most recent one
          handleSelectThread(otherThreads[0].id);
        } else {
          // No other threads available, create a new one
          const newThreadId = await createNewThread();
          if (newThreadId) {
            handleSelectThread(newThreadId);
          }
        }
      } else {
        // No threads available, create a new one
        const newThreadId = await createNewThread();
        if (newThreadId) {
          handleSelectThread(newThreadId);
        }
      }
    } catch (error) {
      console.error("Error handling thread deletion:", error);
      // Create a new thread as fallback
      const newThreadId = await createNewThread();
      if (newThreadId) {
        handleSelectThread(newThreadId);
      }
    }
  };
  
  useEffect(() => {
    const handleThreadDeletedEvent = (event: CustomEvent) => {
      if (event.detail?.threadId) {
        handleThreadDeleted(event.detail.threadId);
      }
    };
    
    window.addEventListener('threadDeleted' as any, handleThreadDeletedEvent);
    
    return () => {
      window.removeEventListener('threadDeleted' as any, handleThreadDeletedEvent);
    };
  }, [currentThreadId, user?.id]);

  const desktopContent = (
    <>
      <Navbar />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="smart-chat-container w-full h-[calc(100vh-4rem)] flex pt-16"
        ref={chatContainerRef}
      >
        {!hasEnoughEntries && !loading && (
          <Alert className="absolute z-10 top-20 left-1/2 transform -translate-x-1/2 w-max mb-6 border-amber-300 bg-amber-50 text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No journal entries found</AlertTitle>
            <AlertDescription className="mt-2">
              <p>The AI Assistant works best when you have journal entries to analyze. Create some journal entries to get personalized insights.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => navigate('/journal')}
              >
                Go to Journal
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="w-72 h-full border-r">
          <ChatThreadList 
            userId={user?.id} 
            onSelectThread={handleSelectThread}
            onStartNewThread={createNewThread}
            currentThreadId={currentThreadId}
          />
        </div>
        
        <div className="flex-1 p-4">
          <SmartChatInterface />
        </div>
      </motion.div>
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
        {!hasEnoughEntries && !loading && (
          <Alert className="mx-3 mt-3 border-amber-300 bg-amber-50 text-amber-800">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">No journal entries found</AlertTitle>
            <AlertDescription className="mt-1 text-xs">
              <p>Create journal entries to get personalized insights.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-1 h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => navigate('/journal')}
              >
                Go to Journal
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex-1 flex flex-col">
          <MobileChatInterface 
            currentThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onCreateNewThread={createNewThread}
            userId={user?.id}
          />
        </div>
      </motion.div>
    </div>
  );
  
  const content = shouldRenderMobile ? mobileContent : desktopContent;
  
  return mobileDemo ? <MobilePreviewFrame>{content}</MobilePreviewFrame> : content;
}
