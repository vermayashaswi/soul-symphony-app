
import { useEffect, useState } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { getCurrentUserId } from '@/utils/audio/auth-utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ensureJournalEntriesHaveEmbeddings } from '@/utils/embeddings-utils';

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
        
        if (count > 0) {
          // Ensure journal entries have embeddings
          await ensureJournalEntriesHaveEmbeddings(currentUserId);
          
          // Double-check that embeddings were created
          const { data: journalEntryIds } = await supabase
            .from('Journal Entries')
            .select('id')
            .eq('user_id', currentUserId);
            
          if (journalEntryIds && journalEntryIds.length > 0) {
            const ids = journalEntryIds.map(entry => entry.id);
            const { count: embeddingCount } = await supabase
              .from('journal_embeddings')
              .select('*', { count: 'exact', head: true })
              .in('journal_entry_id', ids);
              
            console.log(`Found ${embeddingCount} embeddings for ${ids.length} journal entries`);
            
            if (embeddingCount === 0) {
              toast.warning('Could not generate embeddings for your journal entries. Chat may not work properly.');
            }
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
