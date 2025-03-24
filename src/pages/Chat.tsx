
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
  const [embeddingsReady, setEmbeddingsReady] = useState(false);
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
        console.log('Checking journal entries for user:', currentUserId);
        const { count, error } = await supabase
          .from('Journal Entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUserId);
          
        if (error) {
          console.error('Error checking journal entries:', error);
          setIsLoading(false);
          return;
        }
        
        console.log(`User has ${count} journal entries`);
        
        if (count > 0) {
          setHasEntries(true);
          
          // Ensure journal entries have embeddings with multiple attempts if needed
          console.log('Ensuring journal entries have embeddings...');
          let embeddingsResult = false;
          let attempts = 0;
          
          while (!embeddingsResult && attempts < 3) {
            attempts++;
            console.log(`Embedding generation attempt ${attempts}...`);
            embeddingsResult = await ensureJournalEntriesHaveEmbeddings(currentUserId);
            
            if (!embeddingsResult) {
              console.warn(`Embedding generation attempt ${attempts} failed`);
              if (attempts < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
              }
            }
          }
          
          if (!embeddingsResult) {
            console.error('Failed to generate embeddings after multiple attempts');
            toast.warning('Error generating embeddings for journal entries. Chat may not work properly.');
          } else {
            console.log('Successfully ensured journal entries have embeddings');
            setEmbeddingsReady(true);
          }
        } else {
          setHasEntries(false);
        }
        
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
