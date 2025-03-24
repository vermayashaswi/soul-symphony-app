
import { useEffect, useState } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { getCurrentUserId, checkUserHasJournalEntries } from '@/utils/audio/auth-utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Chat() {
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { sidebar, content } = ChatContainer();
  
  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      
      // Get current user ID
      const currentUserId = await getCurrentUserId();
      setUserId(currentUserId);
      
      if (!currentUserId) {
        console.log('No authenticated user found, cannot check for journal entries');
        setHasEntries(false);
        setIsLoading(false);
        return;
      }
      
      console.log('Checking for journal entries for user ID:', currentUserId);
      
      // Directly query the database for journal entries
      try {
        const { count, error } = await supabase
          .from('Journal Entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUserId);
          
        if (error) {
          console.error('Error checking journal entries:', error);
          toast.error('Failed to check for journal entries');
          setIsLoading(false);
          return;
        }
        
        console.log(`User has ${count} journal entries in database query`);
        
        // Also check if embeddings exist for those entries
        const { count: embeddingCount, error: embeddingError } = await supabase
          .from('journal_embeddings')
          .select('*', { count: 'exact', head: true })
          .in('journal_entry_id', 
            supabase
              .from('Journal Entries')
              .select('id')
              .eq('user_id', currentUserId)
          );
          
        if (embeddingError) {
          console.error('Error checking journal embeddings:', embeddingError);
        } else {
          console.log(`Found ${embeddingCount} embeddings for journal entries`);
          
          if (count > 0 && embeddingCount === 0) {
            toast.warning('Your journal entries exist but have no embeddings. The chatbot may not work properly.');
          }
        }
        
        // Also check with our utility function for comparison
        const hasEntriesResult = await checkUserHasJournalEntries(currentUserId);
        console.log('Check user has journal entries result:', hasEntriesResult);
        
        setHasEntries(count > 0);
        
        if (count === 0) {
          toast.info('No journal entries found. Add some journals for personalized responses.');
        } else {
          toast.success(`Found ${count} journal entries for personalized chat experience`);
        }
      } catch (error) {
        console.error('Error checking journal entries:', error);
        toast.error('Failed to check for journal entries');
      } finally {
        setIsLoading(false);
      }
    }
    
    initialize();
  }, []);
  
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
