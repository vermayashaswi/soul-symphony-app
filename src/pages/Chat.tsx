
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
      
      // Directly query the database for journal entries
      try {
        const { count, error } = await supabase
          .from('Journal Entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUserId);
          
        if (error) {
          console.error('Error checking journal entries:', error);
          setIsLoading(false);
          return;
        }
        
        // Check if embeddings exist for those entries
        // First, get the journal entry IDs for this user
        const { data: journalEntryIds, error: idsError } = await supabase
          .from('Journal Entries')
          .select('id')
          .eq('user_id', currentUserId);
          
        if (idsError) {
          console.error('Error fetching journal entry IDs:', idsError);
        } else if (journalEntryIds && journalEntryIds.length > 0) {
          // Now use these IDs to check for embeddings
          const ids = journalEntryIds.map(entry => entry.id);
          const { count: embeddingCount, error: embeddingError } = await supabase
            .from('journal_embeddings')
            .select('*', { count: 'exact', head: true })
            .in('journal_entry_id', ids);
            
          if (embeddingError) {
            console.error('Error checking journal embeddings:', embeddingError);
          }
        }
        
        setHasEntries(count > 0);
        
      } catch (error) {
        console.error('Error checking journal entries:', error);
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
