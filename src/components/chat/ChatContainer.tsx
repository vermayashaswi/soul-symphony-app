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

  // Simplified profile check that assumes no RLS restrictions
  const checkProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Checking if profile exists for user:', user.id);
      
      // Simple profile check - we know the table has no RLS now
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.log('No profile found, creating one');
        
        // Try to create a profile - again, no RLS restrictions
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null
          });
          
        if (insertError) {
          console.error('Error creating profile:', insertError);
          // Don't show error to user - the database trigger will handle it
        }
      } else {
        console.log('Profile exists:', data.id);
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
