
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase, isChunkingSupported, checkEdgeFunctionsHealth } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';
import { Json } from '@/integrations/supabase/types';

export function useJournalEntries(userId: string | undefined, refreshKey: number, isProfileChecked: boolean = false) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [lastRefreshKey, setLastRefreshKey] = useState(refreshKey);
  const [isChunkingEnabled, setIsChunkingEnabled] = useState(false);
  const [processFailures, setProcessFailures] = useState<Record<number, number>>({});
  const [edgeFunctionsHealth, setEdgeFunctionsHealth] = useState<Record<string, boolean>>({});
  
  const isFetchingRef = useRef(false);
  const initialFetchDoneRef = useRef(false);

  // Check if chunking is supported and edge functions health
  useEffect(() => {
    async function checkSystemStatus() {
      try {
        // First check chunking support
        const chunking = await isChunkingSupported();
        console.log(`Chunking support detected: ${chunking}`);
        setIsChunkingEnabled(chunking);
        
        // Then check edge functions health
        const healthStatus = await checkEdgeFunctionsHealth();
        console.log("Edge functions health status:", healthStatus);
        setEdgeFunctionsHealth(healthStatus);
        
        if (!healthStatus['process-journal']) {
          console.warn("process-journal function is not healthy");
        }
      } catch (error) {
        console.error("Error checking system status:", error);
        setIsChunkingEnabled(false);
      }
    }
    
    checkSystemStatus();
  }, []);

  // Process an entry for chunking and embedding
  const processJournalEntry = useCallback(async (entryId: number) => {
    if (!isChunkingEnabled) {
      console.log(`Chunking not enabled, skipping processing for entry ${entryId}`);
      return false;
    }
    
    // Check if process-journal function is healthy
    if (edgeFunctionsHealth['process-journal'] === false) {
      console.log(`Skipping processing for entry ${entryId} as process-journal function is not healthy`);
      return false;
    }
    
    // Check if we've already failed too many times with this entry
    if (processFailures[entryId] && processFailures[entryId] >= 3) {
      console.log(`Skipping processing for entry ${entryId} after ${processFailures[entryId]} failures`);
      return false;
    }
    
    try {
      console.log(`Processing journal entry ${entryId} for chunking`);
      
      // Create a promise that will reject after a timeout
      const timeoutPromise = new Promise<{success: false; error: string}>((_, reject) => {
        setTimeout(() => reject(new Error('Function call timed out')), 15000);
      });
      
      // Create the actual function call
      const functionCallPromise = supabase.functions.invoke('process-journal', {
        body: { entryId }
      });
      
      // Race between the timeout and the actual call
      const result = await Promise.race([functionCallPromise, timeoutPromise])
        .catch(error => {
          console.error('Error or timeout in process-journal function:', error);
          // Try a direct health check to diagnose the issue
          checkEdgeFunctionsHealth().then(status => {
            console.log('Edge function health after failure:', status);
            setEdgeFunctionsHealth(status);
          });
          return { success: false, error: error.message || 'Function call failed' };
        });
      
      if (!result || ('error' in result)) {
        console.error('Error processing journal entry:', result?.error);
        // Track failures
        setProcessFailures(prev => ({
          ...prev,
          [entryId]: (prev[entryId] || 0) + 1
        }));
        
        return false;
      }
      
      // Use type assertion to handle property access safely
      const responseData = result as unknown as { success: boolean; chunks_count?: number };
      console.log(`Successfully processed journal entry ${entryId} into ${responseData.chunks_count || 0} chunks`);
      return true;
    } catch (error) {
      console.error('Error invoking process-journal function:', error);
      
      // Track failures
      setProcessFailures(prev => ({
        ...prev,
        [entryId]: (prev[entryId] || 0) + 1
      }));
      
      // If we've failed twice, display a toast to let the user know
      if ((processFailures[entryId] || 0) === 2) {
        toast.error("Having trouble processing some journal entries. This won't affect your content.");
      }
      
      return false;
    }
  }, [isChunkingEnabled, processFailures, edgeFunctionsHealth]);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      console.log('No user ID provided for fetching entries');
      setLoading(false);
      return;
    }
    
    if (isFetchingRef.current) {
      console.log('[useJournalEntries] Skipping fetch as one is already in progress');
      return;
    }
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const fetchStartTime = Date.now();
      console.log(`[useJournalEntries] Fetching entries for user ID: ${userId} (fetch #${fetchCount + 1})`);
      
      const { data, error, status } = await supabase
        .from('Journal Entries')
        .select('*, is_chunked, chunks_count')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      const fetchEndTime = Date.now();
      console.log(`[useJournalEntries] Fetch completed in ${fetchEndTime - fetchStartTime}ms with status: ${status}`);
        
      if (error) {
        console.error('[useJournalEntries] Error fetching entries:', error);
        toast.error('Failed to load journal entries');
        throw error;
      }
      
      console.log(`[useJournalEntries] Fetched ${data?.length || 0} entries`);
      
      if (data && data.length > 0) {
        console.log('[useJournalEntries] First entry sample:', {
          id: data[0].id,
          text: data[0]["refined text"],
          created: data[0].created_at
        });
        
        if (isChunkingEnabled) {
          // Process entries that haven't been chunked yet
          const unchunkedEntries = data.filter(entry => entry.is_chunked === false && (entry["refined text"] || entry["transcription text"]));
          if (unchunkedEntries.length > 0) {
            console.log(`[useJournalEntries] Found ${unchunkedEntries.length} entries that need processing`);
            
            // Process only 1 entry at a time to reduce load
            const entryToProcess = unchunkedEntries[0];
            const success = await processJournalEntry(entryToProcess.id);
            
            if (success) {
              console.log(`[useJournalEntries] Successfully processed entry ${entryToProcess.id}`);
            } else {
              console.log(`[useJournalEntries] Failed to process entry ${entryToProcess.id}`);
            }
            
            if (unchunkedEntries.length > 1) {
              console.log(`[useJournalEntries] ${unchunkedEntries.length - 1} more entries will be processed later`);
            }
          }
        }
      } else {
        console.log('[useJournalEntries] No entries found for this user');
      }
      
      const typedEntries: JournalEntry[] = (data || []).map(item => ({
        id: item.id,
        content: item["refined text"] || item["transcription text"] || "",
        created_at: item.created_at,
        audio_url: item.audio_url,
        sentiment: item.sentiment,
        themes: item.master_themes,
        foreignKey: item["foreign key"],
        isChunked: item.is_chunked || false,
        chunksCount: item.chunks_count || 0,
        entities: item.entities ? (item.entities as any[]).map(entity => ({
          type: entity.type,
          name: entity.name,
          text: entity.text
        })) : undefined
      }));
      
      setEntries(typedEntries);
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
      initialFetchDoneRef.current = true;
    } catch (error) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId, fetchCount, processJournalEntry, isChunkingEnabled]);

  useEffect(() => {
    if (userId && isProfileChecked) {
      const isInitialLoad = !initialFetchDoneRef.current;
      const hasRefreshKeyChanged = refreshKey !== lastRefreshKey;
      
      if (isInitialLoad || hasRefreshKeyChanged) {
        console.log(`[useJournalEntries] Effect triggered: initial=${isInitialLoad}, refreshKey changed=${hasRefreshKeyChanged}`);
        fetchEntries();
        setLastRefreshKey(refreshKey);
      } else {
        console.log(`[useJournalEntries] Skipping unnecessary fetch`);
      }
    } else {
      console.log(`[useJournalEntries] Waiting for prerequisites: userId=${!!userId}, isProfileChecked=${isProfileChecked}`);
      setLoading(userId !== undefined);
    }
  }, [userId, refreshKey, isProfileChecked, fetchEntries, lastRefreshKey]);

  return { 
    entries, 
    loading, 
    fetchEntries,
    lastFetchTime,
    fetchCount,
    processJournalEntry,
    isChunkingEnabled,
    edgeFunctionsHealth
  };
}
