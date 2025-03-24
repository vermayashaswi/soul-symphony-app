import { useEffect, useState } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { getCurrentUserId } from '@/utils/audio/auth-utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ensureJournalEntriesHaveEmbeddings } from '@/utils/embeddings';
import { JournalEntry } from '@/types/journal';

export default function Chat() {
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [embeddingsReady, setEmbeddingsReady] = useState(false);
  const { sidebar, content } = ChatContainer();
  
  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      
      const currentUserId = await getCurrentUserId();
      setUserId(currentUserId);
      
      if (!currentUserId) {
        console.log('No authenticated user found, cannot check for journal entries');
        setHasEntries(false);
        setIsLoading(false);
        return;
      }
      
      try {
        console.log('Checking journal entries for user:', currentUserId);
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('id, refined text')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error checking journal entries:', error);
          setIsLoading(false);
          return;
        }
        
        const validEntries = (entries as JournalEntry[] || []).filter(entry => 
          entry && 
          typeof entry.id === 'number' && 
          entry["refined text"] && 
          typeof entry["refined text"] === 'string'
        );
        
        console.log(`User has ${validEntries.length} valid journal entries with text`);
        
        if (validEntries.length > 0) {
          setHasEntries(true);
          
          const { data: embeddings, error: embError } = await supabase
            .from('journal_embeddings')
            .select('journal_entry_id')
            .in('journal_entry_id', validEntries.map(e => e.id));
            
          if (embError) {
            console.error('Error checking for embeddings:', embError);
          } else {
            const entriesWithEmbeddings = embeddings?.length || 0;
            console.log(`Found ${entriesWithEmbeddings} entries with embeddings out of ${validEntries.length} entries`);
            
            const missingEmbeddings = entriesWithEmbeddings < validEntries.length;
            
            if (missingEmbeddings) {
              console.log('Some journal entries are missing embeddings, generating...');
              toast.info('Preparing your journal entries for chat...');
              
              let embeddingsResult = false;
              let attempts = 0;
              
              while (!embeddingsResult && attempts < 3) {
                attempts++;
                console.log(`Embedding generation attempt ${attempts}...`);
                embeddingsResult = await ensureJournalEntriesHaveEmbeddings(currentUserId);
                
                if (!embeddingsResult) {
                  console.warn(`Embedding generation attempt ${attempts} failed`);
                  if (attempts < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              }
              
              if (!embeddingsResult) {
                console.error('Failed to generate embeddings after multiple attempts');
                toast.warning('Could not prepare all journal entries for chat. Some entries may not be accessible.');
              } else {
                console.log('Successfully ensured journal entries have embeddings');
                setEmbeddingsReady(true);
                toast.success('Journal entries prepared for chat');
              }
            } else {
              console.log('All journal entries already have embeddings');
              setEmbeddingsReady(true);
            }
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
