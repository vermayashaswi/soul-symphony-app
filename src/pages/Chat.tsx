
import { useEffect, useState } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { getCurrentUserId } from '@/utils/audio/auth-utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Chat() {
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const { sidebar, content } = ChatContainer();
  
  useEffect(() => {
    checkForJournalEntries();
  }, []);
  
  const checkForJournalEntries = async () => {
    try {
      const userId = await getCurrentUserId();
      
      if (!userId) {
        console.log('No authenticated user found');
        return;
      }
      
      console.log('Checking for journal entries for user ID:', userId);
      
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (error) {
        console.error('Error checking journal entries:', error);
        return;
      }
      
      console.log(`User has ${count} journal entries`);
      setHasEntries(count > 0);
      
      if (count === 0) {
        toast.info('No journal entries found. Add some journals for personalized responses.');
      }
    } catch (error) {
      console.error('Error checking journal entries:', error);
    }
  };
  
  return (
    <ChatLayout 
      sidebar={sidebar}
      content={content}
    />
  );
}
