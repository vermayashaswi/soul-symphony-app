
import { useEffect, useState } from 'react';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { getCurrentUserId } from '@/utils/audio/auth-utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ensureJournalEntriesHaveEmbeddings, debugEmbeddingIssues } from '@/utils/embeddings';
import { JournalEntry } from '@/types/journal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function Chat() {
  const [hasEntries, setHasEntries] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [embeddingsReady, setEmbeddingsReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
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
        await checkJournalEntries(currentUserId);
      } catch (error) {
        console.error('Error in initialization:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    initialize();
  }, []);
  
  async function checkJournalEntries(currentUserId: string) {
    try {
      console.log('Checking journal entries for user:', currentUserId);
      const { data: entriesData, error } = await supabase
        .from('Journal Entries')
        .select('id, refined text')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });
          
      if (error) {
        console.error('Error checking journal entries:', error);
        return;
      }
        
      // Properly type and filter the entries
      const entries = entriesData as any[] || [];
      const validEntries = entries.filter(entry => 
        entry && 
        typeof entry.id === 'number' && 
        entry["refined text"] && 
        typeof entry["refined text"] === 'string'
      ) as JournalEntry[];
        
      console.log(`User has ${validEntries.length} valid journal entries with text`);
        
      if (validEntries.length > 0) {
        setHasEntries(true);
          
        // Generate embeddings for all entries
        console.log('Making sure all journal entries have embeddings...');
        toast.info('Preparing your journal entries for chat...');
          
        // Try up to 3 times to generate embeddings
        let embeddingsResult = false;
        let attempts = 0;
          
        while (!embeddingsResult && attempts < 3) {
          attempts++;
          console.log(`Embedding generation attempt ${attempts}...`);
            
          try {
            embeddingsResult = await ensureJournalEntriesHaveEmbeddings(currentUserId);
          } catch (error) {
            console.error(`Error in embedding generation attempt ${attempts}:`, error);
          }
            
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
        setHasEntries(false);
      }
    } catch (error) {
      console.error('Error checking journal entries:', error);
    }
  }
  
  const handleRefreshEmbeddings = async () => {
    if (!userId || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      toast.info('Refreshing journal embeddings...');
      const result = await ensureJournalEntriesHaveEmbeddings(userId);
      if (result) {
        toast.success('Journal entries prepared for chat');
        setEmbeddingsReady(true);
      } else {
        toast.error('Failed to prepare some journal entries');
      }
    } catch (error) {
      console.error('Error refreshing embeddings:', error);
      toast.error('Failed to refresh embeddings');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleDebugEmbeddings = async () => {
    if (!userId) return;
    
    try {
      const debugData = await debugEmbeddingIssues(userId);
      setDebugInfo(debugData);
      setShowDebug(true);
    } catch (error) {
      console.error('Error debugging embeddings:', error);
      toast.error('Failed to debug embeddings');
    }
  };
  
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
      content={
        <>
          {hasEntries === false && !isLoading && (
            <Alert variant="warning" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Journal Entries Found</AlertTitle>
              <AlertDescription>
                To get personalized insights, please add some journal entries first. 
                This will help me provide more relevant advice based on your experiences.
              </AlertDescription>
            </Alert>
          )}
          
          {hasEntries === true && !embeddingsReady && !isLoading && (
            <Alert variant="warning" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Embeddings Not Ready</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <p>Your journal entries may not be properly prepared for chat. 
                The chatbot might not be able to reference your journals correctly.</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button 
                    onClick={handleRefreshEmbeddings} 
                    size="sm" 
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Embeddings
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleDebugEmbeddings}
                    variant="outline"
                    size="sm"
                  >
                    Debug Embeddings
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {showDebug && debugInfo && (
            <Card className="m-4 p-4 max-h-64 overflow-auto">
              <h3 className="text-sm font-medium mb-2">Embedding Debug Information</h3>
              <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">{debugInfo}</pre>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2" 
                onClick={() => setShowDebug(false)}
              >
                Hide Debug Info
              </Button>
            </Card>
          )}
          
          {content}
        </>
      }
    />
  );
}
