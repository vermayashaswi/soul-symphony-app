
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase, isChunkingSupported } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';
import { Json } from '@/integrations/supabase/types';

export function useJournalEntries(userId: string | undefined, refreshKey: number, isProfileChecked: boolean = false) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [lastRefreshKey, setLastRefreshKey] = useState(refreshKey);
  const [isChunkingEnabled, setIsChunkingEnabled] = useState(false);
  
  const isFetchingRef = useRef(false);
  const initialFetchDoneRef = useRef(false);

  // Check if chunking is supported
  useEffect(() => {
    async function checkChunkingSupport() {
      try {
        const chunking = await isChunkingSupported();
        console.log(`Chunking support detected: ${chunking}`);
        setIsChunkingEnabled(chunking);
      } catch (error) {
        console.error("Error checking chunking support:", error);
        setIsChunkingEnabled(false);
      }
    }
    
    checkChunkingSupport();
  }, []);

  // Process an entry for chunking and embedding
  const processJournalEntry = useCallback(async (entryId: number) => {
    if (!isChunkingEnabled) {
      console.log(`Chunking not enabled, skipping processing for entry ${entryId}`);
      return false;
    }
    
    try {
      console.log(`Processing journal entry ${entryId} for chunking`);
      const { data, error } = await supabase.functions.invoke('process-journal', {
        body: { entryId }
      });
      
      if (error) {
        console.error('Error processing journal entry:', error);
        return false;
      }
      
      console.log(`Successfully processed journal entry ${entryId} into ${data.chunks_count} chunks`);
      return true;
    } catch (error) {
      console.error('Error invoking process-journal function:', error);
      return false;
    }
  }, [isChunkingEnabled]);

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
            
            // Process up to 3 entries at a time to avoid overloading
            const entriesToProcess = unchunkedEntries.slice(0, 3);
            for (const entry of entriesToProcess) {
              await processJournalEntry(entry.id);
            }
            
            if (unchunkedEntries.length > 3) {
              console.log(`[useJournalEntries] Queued ${unchunkedEntries.length - 3} more entries for future processing`);
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
    isChunkingEnabled
  };
}
