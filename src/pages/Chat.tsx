
import { useEffect, useState } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Chat() {
  const [isLoading, setIsLoading] = useState(true);
  const { user, session } = useAuth();
  const { sidebar, content } = ChatContainer();
  
  useEffect(() => {
    async function checkUserProfile() {
      setIsLoading(true);
      
      if (!user) {
        console.log('No authenticated user found');
        setIsLoading(false);
        return;
      }
      
      try {
        // Check if user has a profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error checking profile:', profileError);
          toast.error('Error checking user profile');
        }
        
        // If no profile exists, create one
        if (!profile) {
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
            toast.error('Failed to create user profile');
          } else {
            console.log('Created new user profile');
          }
        } else {
          console.log('User profile exists:', profile.id);
        }
      } catch (error) {
        console.error('Error in profile initialization:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkUserProfile();
  }, [user]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <ChatLayout 
      sidebar={sidebar}
      content={content}
    />
  );
}
