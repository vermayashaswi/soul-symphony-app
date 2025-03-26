
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import ChatArea from '@/components/chat/ChatArea';
import ChatThreadList from '@/components/chat/ChatThreadList';
import { Skeleton } from '@/components/ui/skeleton';
import { ensureUserProfile } from '@/utils/profile-helpers';

export function ChatContainer() {
  const { user, isLoading: authLoading } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Simplified profile check using our new helpers
  const checkProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Checking if profile exists for user:', user.id);
      
      const profile = await ensureUserProfile(user.id, {
        email: user.email,
        full_name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url
      });
      
      if (profile) {
        console.log('Profile exists or was created:', profile.id);
        setIsInitialized(true);
      } else {
        console.error('Failed to ensure profile existence');
        toast.error('Failed to initialize user profile');
      }
    } catch (error) {
      console.error('Error in profile check:', error);
    } finally {
      setIsInitialized(true);
    }
  }, [user]);

  useEffect(() => {
    // Check profile when user is available
    if (user && !isInitialized) {
      checkProfile();
    }
    
    // Reset state if user changes
    if (!user) {
      setCurrentThreadId(null);
      setIsInitialized(false);
    }
  }, [user, isInitialized, checkProfile]);

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

  // Return loading UI if auth is still loading
  if (authLoading || (user && !isInitialized)) {
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
            Loading chat...
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
