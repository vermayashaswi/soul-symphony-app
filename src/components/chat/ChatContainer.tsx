
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Check/create profile when user is available
    if (user && !isInitialized && !profileChecked && !isCheckingProfile) {
      setIsCheckingProfile(true);
      
      const checkAndCreateProfile = async () => {
        try {
          // Check if profile exists
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
            
          if (profileError || !profile) {
            console.log('Profile not found or error, trying to create one:', profileError);
            
            // Try to create profile
            const { error: createError } = await supabase
              .from('profiles')
              .insert([{ id: user.id }]);
              
            if (createError) {
              console.error('Failed to create profile:', createError);
              toast.error('Failed to set up your profile. Some features may not work properly.');
            } else {
              console.log('Profile created successfully');
            }
          }
        } catch (error) {
          console.error('Error in profile check/creation:', error);
        } finally {
          setProfileChecked(true);
          setIsCheckingProfile(false);
          setIsInitialized(true);
        }
      };
      
      checkAndCreateProfile();
    }
    
    // Reset state if user changes
    if (!user) {
      setCurrentThreadId(null);
      setIsInitialized(false);
      setProfileChecked(false);
    }
  }, [user, isInitialized, profileChecked, isCheckingProfile]);

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
