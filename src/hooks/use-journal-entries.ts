
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase, isChunkingSupported, checkEdgeFunctionsHealth, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
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

  useEffect(() => {
    async function checkSystemStatus() {
      try {
        console.log("Checking chunking support status...");
        const chunking = await isChunkingSupported();
        console.log(`Chunking support detected: ${chunking}`);
        setIsChunkingEnabled(chunking);
        
        console.log("Checking edge functions health...");
        const healthStatus = await checkEdgeFunctionsHealth();
        console.log("Edge functions health status:", healthStatus);
        setEdgeFunctionsHealth(healthStatus);
        
        if (!healthStatus['process-journal']) {
          console.warn("process-journal function is not healthy, direct testing health endpoint...");
          // Add direct test of health endpoint
          try {
            const healthResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-journal/health`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (healthResponse.ok) {
              console.log("Direct health check successful:", await healthResponse.json());
              // Override the health status if direct check succeeds
              setEdgeFunctionsHealth(prev => ({...prev, 'process-journal': true}));
            } else {
              console.warn(`Direct health check failed with status: ${healthResponse.status}`);
            }
          } catch (directError) {
            console.error("Direct health check error:", directError);
          }
        }
      } catch (error) {
        console.error("Error checking system status:", error);
        setIsChunkingEnabled(false);
      }
    }
    
    checkSystemStatus();
  }, []);

  const processJournalEntry = useCallback(async (entryId: number) => {
    if (!isChunkingEnabled) {
      console.log(`Chunking not enabled, skipping processing for entry ${entryId}`);
      return false;
    }
    
    if (edgeFunctionsHealth['process-journal'] === false) {
      console.log(`Skipping processing for entry ${entryId} as process-journal function is not healthy`);
      return false;
    }
    
    if (processFailures[entryId] && processFailures[entryId] >= 3) {
      console.log(`Skipping processing for entry ${entryId} after ${processFailures[entryId]} failures`);
      return false;
    }
    
    try {
      console.log(`Processing journal entry ${entryId} for chunking`);
      
      // Try direct fetch with explicit headers and timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      console.log(`Invoking process-journal function for entry ${entryId} using direct fetch`);
      
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/process-journal`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ entryId }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Function response not OK: ${response.status} - ${errorText}`);
          throw new Error(`Function returned ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          console.error('Error in process-journal result:', result.error);
          setProcessFailures(prev => ({
            ...prev,
            [entryId]: (prev[entryId] || 0) + 1
          }));
          
          return false;
        }
        
        console.log(`Successfully processed journal entry ${entryId} into ${result.chunks_count || 0} chunks`);
        return true;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('Direct fetch error:', fetchError);
        
        // Fall back to supabase.functions.invoke approach
        console.log('Falling back to supabase.functions.invoke approach...');
        
        const result = await supabase.functions.invoke('process-journal', {
          body: { entryId }
        });
        
        if ('error' in result) {
          console.error('Error in fallback invoke call:', result.error);
          setProcessFailures(prev => ({
            ...prev,
            [entryId]: (prev[entryId] || 0) + 1
          }));
          
          return false;
        }
        
        console.log(`Successfully processed journal entry ${entryId} via fallback method`);
        return true;
      }
    } catch (error) {
      console.error('Error processing journal entry:', error);
      
      setProcessFailures(prev => ({
        ...prev,
        [entryId]: (prev[entryId] || 0) + 1
      }));
      
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
          const unchunkedEntries = data.filter(entry => entry.is_chunked === false && (entry["refined text"] || entry["transcription text"]));
          if (unchunkedEntries.length > 0) {
            console.log(`[useJournalEntries] Found ${unchunkedEntries.length} entries that need processing`);
            
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
