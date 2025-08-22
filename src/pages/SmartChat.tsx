
import React, { useEffect, useState } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import MobileChatInterface from '@/components/chat/mobile/MobileChatInterface';
import DesktopChatLayout from '@/components/chat/DesktopChatLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { v4 as uuidv4 } from 'uuid';
import { PremiumFeatureGuard } from '@/components/subscription/PremiumFeatureGuard';
import { setupGlobalMessageDeletionListener } from '@/hooks/use-message-deletion';
import { processingStateManager } from '@/utils/chat/processingStateManager';
import { cleanupStaleProcessingMessages } from '@/utils/chat/messageCleanup';

const SmartChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Redirect to login if not authenticated - with iOS browser handling
  useEffect(() => {
    if (!user) {
      console.log('[SmartChat] No user found, redirecting to auth');
      // For iOS Safari/Chrome browsers, use location.href to prevent navigation issues
      if (isMobile.isIOS) {
        window.location.href = '/app/auth';
      } else {
        navigate('/app/auth');
      }
    }
  }, [user, navigate, isMobile.isIOS]);

  // Load the last active thread on component mount
  useEffect(() => {
    const loadLastThread = async () => {
      if (!user?.id) return;
      
      const storedThreadId = localStorage.getItem("lastActiveChatThreadId");
      if (storedThreadId) {
        // Verify the thread exists and belongs to the user
        const { data: thread, error } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('id', storedThreadId)
          .eq('user_id', user.id)
          .single();
          
        if (!error && thread) {
          setCurrentThreadId(storedThreadId);
          return;
        }
      }
      
      // If no stored thread or it doesn't exist, get the most recent thread
      const { data: threads, error } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
        
      if (!error && threads && threads.length > 0) {
        setCurrentThreadId(threads[0].id);
        localStorage.setItem("lastActiveChatThreadId", threads[0].id);
      }
    };
    
    loadLastThread();
  }, [user?.id]);

  // Setup global message deletion listener and cleanup
  useEffect(() => {
    if (!user?.id) return;
    
    const subscription = setupGlobalMessageDeletionListener(user.id);
    
    // Clean up stale processing messages for this user when SmartChat loads
    const initCleanup = async () => {
      try {
        console.log('[SmartChat] Performing initial cleanup...');
        const result = await cleanupStaleProcessingMessages(10, user.id);
        console.log(`[SmartChat] Cleanup completed: ${result.cleaned} messages cleaned`);
        
        // Recover stuck messages
        await processingStateManager.recoverStuckMessages();
      } catch (error) {
        console.error('[SmartChat] Error during initial cleanup:', error);
      }
    };
    
    initCleanup();
    
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user?.id]);

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
    localStorage.setItem("lastActiveChatThreadId", threadId);
  };

  const handleCreateNewThread = async (): Promise<string | null> => {
    if (!user?.id) {
      console.error('[SmartChat] Cannot create thread: user not authenticated');
      toast({
        title: "Authentication required",
        description: "Please sign in to create a new conversation",
        variant: "destructive"
      });
      return null;
    }
    
    try {
      console.log('[SmartChat] Creating new thread for user:', user.id);
      
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
      
      if (error) {
        console.error("[SmartChat] Error creating new thread:", error);
        toast({
          title: "Error",
          description: "Failed to create new conversation",
          variant: "destructive"
        });
        return null;
      }
      
      console.log('[SmartChat] Successfully created new thread:', newThreadId);
      setCurrentThreadId(newThreadId);
      localStorage.setItem("lastActiveChatThreadId", newThreadId);
      return newThreadId;
    } catch (error) {
      console.error("[SmartChat] Exception creating new thread:", error);
      toast({
        title: "Error", 
        description: "Failed to create new conversation",
        variant: "destructive"
      });
      return null;
    }
  };

  console.log("[SmartChat] Rendering with mobile detection:", isMobile.isMobile);

  return (
    <PremiumFeatureGuard feature="chat">
      <div 
        className="w-full h-full flex flex-col smart-chat-container"
        style={{
          position: 'fixed',
          top: '3px',
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: 'calc(100% - 3px)'
        }}
      >
        {isMobile.isMobile ? (
          <MobileChatInterface
            currentThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onCreateNewThread={handleCreateNewThread}
            userId={user?.id}
          />
        ) : (
          <DesktopChatLayout
            currentThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onCreateNewThread={handleCreateNewThread}
            userId={user?.id}
          />
        )}
      </div>
    </PremiumFeatureGuard>
  );
};

export default SmartChat;
