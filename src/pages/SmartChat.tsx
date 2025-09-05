
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
import { ProfileOnboardingOverlay } from '@/components/profile/ProfileOnboardingOverlay';

const SmartChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isProcessingActive, setIsProcessingActive] = useState(false);
  const [showProfileOverlay, setShowProfileOverlay] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const isMobile = useIsMobile();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/app/auth');
    }
  }, [user, navigate]);

  // Check if user needs profile onboarding overlay
  useEffect(() => {
    const checkProfileOnboarding = async () => {
      if (!user?.id) {
        setIsCheckingProfile(false);
        return;
      }

      try {
        console.log('[SmartChat] Checking first_smart_chat_visit for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_smart_chat_visit, profile_onboarding_completed')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('[SmartChat] Error checking profile:', error);
          setIsCheckingProfile(false);
          return;
        }

        console.log('[SmartChat] Profile data:', profile);

        // Show overlay if this is first smart chat visit
        // Don't show if they already completed the old onboarding flow
        if (profile?.first_smart_chat_visit && !profile?.profile_onboarding_completed) {
          setShowProfileOverlay(true);
        }
        
        setIsCheckingProfile(false);
      } catch (error) {
        console.error('[SmartChat] Exception checking profile:', error);
        setIsCheckingProfile(false);
      }
    };

    checkProfileOnboarding();
  }, [user?.id]);

  // Load the last active thread on component mount
  useEffect(() => {
    const loadLastThread = async () => {
      if (!user?.id || isCheckingProfile) return;
      
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
  }, [user?.id, isCheckingProfile]);

  // Setup global message deletion listener
  useEffect(() => {
    if (!user?.id) return;
    
    const subscription = setupGlobalMessageDeletionListener(user.id);
    
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
      
      // Enhanced error handling for thread creation
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
        console.error("[SmartChat] Error creating new thread:", {
          error_code: error.code,
          error_message: error.message,
          error_details: error.details,
          error_hint: error.hint,
          user_id: user.id,
          new_thread_id: newThreadId
        });
        
        // Enhanced error messages for common issues
        let errorMessage = "Failed to create new conversation";
        if (error.message?.includes('row-level security') || error.code === 'PGRST116') {
          errorMessage = "Authentication issue detected. Please refresh the page and try again.";
          console.error("[SmartChat] RLS POLICY VIOLATION during thread creation:", {
            userId: user.id,
            error_details: error
          });
        } else if (error.code === '23505') {
          // Duplicate key error
          errorMessage = "A conversation with this ID already exists. Please try again.";
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
        return null;
      }
      
      console.log('[SmartChat] Successfully created new thread:', newThreadId);
      setCurrentThreadId(newThreadId);
      localStorage.setItem("lastActiveChatThreadId", newThreadId);
      return newThreadId;
    } catch (error) {
      console.error("[SmartChat] Exception creating new thread:", {
        error,
        userId: user.id,
        stack: error instanceof Error ? error.stack : 'No stack available'
      });
      toast({
        title: "Error", 
        description: "An unexpected error occurred while creating the conversation. Please try again.",
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
            onProcessingStateChange={setIsProcessingActive}
          />
        ) : (
          <DesktopChatLayout
            currentThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onCreateNewThread={handleCreateNewThread}
            userId={user?.id}
            isProcessingActive={isProcessingActive}
            onProcessingStateChange={setIsProcessingActive}
          />
        )}
        
        {/* Profile Onboarding Overlay */}
        {showProfileOverlay && (
          <ProfileOnboardingOverlay
            onClose={() => setShowProfileOverlay(false)}
            onComplete={() => setShowProfileOverlay(false)}
            onSkip={() => setShowProfileOverlay(false)}
          />
        )}
      </div>
    </PremiumFeatureGuard>
  );
};

export default SmartChat;
