
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import ChatArea from '@/components/chat/ChatArea';
import ChatThreadList from '@/components/chat/ChatThreadList';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

export function ChatContainer() {
  const { user, isLoading: authLoading } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  // Create a profile check function that can be safely retried
  const checkAndCreateProfile = useCallback(async () => {
    if (!user || isCheckingProfile) return;
    
    setIsCheckingProfile(true);
    
    try {
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (profileError && !profileError.message.includes('Results contain 0 rows')) {
        console.error('Error checking profile:', profileError);
      }
      
      if (!profile) {
        console.log('Profile not found, relying on database trigger');
        // We don't need to create the profile manually anymore 
        // as our database trigger will handle it
      } else {
        console.log('Profile found:', profile.id);
      }
    } catch (error) {
      console.error('Error in profile check/creation:', error);
    } finally {
      setProfileChecked(true);
      setIsCheckingProfile(false);
      setIsInitialized(true);
    }
  }, [user, isCheckingProfile]);

  useEffect(() => {
    // Check/create profile when user is available
    if (user && !isInitialized && !profileChecked && !isCheckingProfile) {
      checkAndCreateProfile();
    }
    
    // Reset state if user changes
    if (!user) {
      setCurrentThreadId(null);
      setIsInitialized(false);
      setProfileChecked(false);
    }
  }, [user, isInitialized, profileChecked, isCheckingProfile, checkAndCreateProfile]);

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const handleStartNewThread = () => {
    setCurrentThreadId(null);
  };

  const handleNewThreadCreated = (threadId: string) => {
    setCurrentThreadId(threadId);
    toast.success('New chat started');
  };

  // Return loading UI if auth is still loading or checking profile
  if (authLoading || (user && isCheckingProfile)) {
    return {
      sidebar: (
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ),
      content: (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground mt-2">
            {isCheckingProfile ? 'Setting up your profile...' : 'Loading chat...'}
          </p>
        </div>
      )
    };
  }

  return {
    sidebar: (
      <ChatThreadList 
        userId={user?.id}
        onSelectThread={handleSelectThread}
        onStartNewThread={handleStartNewThread}
        currentThreadId={currentThreadId}
      />
    ),
    content: (
      <ChatArea 
        userId={user?.id}
        threadId={currentThreadId}
        onNewThreadCreated={handleNewThreadCreated}
      />
    )
  };
}
