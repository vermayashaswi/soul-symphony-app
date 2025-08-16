
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
import { AuthPrompt } from '@/components/auth/AuthPrompt';
import { useAuthGuard } from '@/hooks/useAuthGuard';

const SmartChat = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { isAuthenticated, requireAuth } = useAuthGuard({
    feature: 'Smart Chat'
  });

  // Show authentication prompt if user is not logged in
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <AuthPrompt 
          title="Smart Chat Access"
          description="Connect with your AI assistant for personalized conversations"
          feature="Smart Chat"
        />
      </div>
    );
  }

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Load the last active thread on component mount
  useEffect(() => {
    if (!requireAuth()) return;
    
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
  }, [user?.id, requireAuth]);

  // Setup global message deletion listener
  useEffect(() => {
    if (!user?.id || !requireAuth()) return;
    
    const subscription = setupGlobalMessageDeletionListener(user.id);
    
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user?.id, requireAuth]);

  const handleSelectThread = (threadId: string) => {
    if (!requireAuth()) return;
    setCurrentThreadId(threadId);
    localStorage.setItem("lastActiveChatThreadId", threadId);
  };

  const handleCreateNewThread = async (): Promise<string | null> => {
    if (!requireAuth()) return null;
    
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
      <div className="w-full h-full flex flex-col">
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
