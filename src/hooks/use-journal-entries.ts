import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';

export function useJournalEntries(userId: string | undefined, refreshKey: number, isProfileChecked: boolean = false) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [lastRefreshKey, setLastRefreshKey] = useState(refreshKey);
  const [error, setError] = useState<string | null>(null);
  
  const isFetchingRef = useRef(false);
  const initialFetchDoneRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      console.log('[useJournalEntries] No user ID provided for fetching entries');
      setLoading(false);
      setEntries([]);
      initialFetchDoneRef.current = true;
      return;
    }
    
    if (isFetchingRef.current) {
      console.log('[useJournalEntries] Skipping fetch as one is already in progress');
      return;
    }
    
    // Clear any previous errors
    setError(null);
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      const fetchStartTime = Date.now();
      console.log(`[useJournalEntries] Fetching entries for user ID: ${userId} (fetch #${fetchCount + 1})`);
      
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.error('[useJournalEntries] No active session found');
        setEntries([]);
        setLoading(false);
        isFetchingRef.current = false;
        initialFetchDoneRef.current = true;
        setError('No active session. Please sign in again.');
        return;
      }
      
      // Set a timeout in case the fetch takes too long
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      fetchTimeoutRef.current = setTimeout(() => {
        if (isFetchingRef.current) {
          console.log('[useJournalEntries] Fetch is taking too long, setting loading to false');
          setLoading(false);
          initialFetchDoneRef.current = true;
          // Don't set isFetchingRef to false here so the actual fetch can still complete
        }
      }, 8000); // 8 second timeout for UI loading state
      
      const { data, error, status } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      // Clear the timeout as fetch completed
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      
      const fetchEndTime = Date.now();
      console.log(`[useJournalEntries] Fetch completed in ${fetchEndTime - fetchStartTime}ms with status: ${status}`);
        
      if (error) {
        console.error('[useJournalEntries] Error fetching entries:', error);
        
        // Only show toast error on initial load and if it's not just "No rows returned"
        if (!initialFetchDoneRef.current && !error.message.includes('No rows returned')) {
          toast.error('Failed to load journal entries. Please try again later.');
        }
        
        setError('Failed to load entries: ' + error.message);
        
        // If there's no data, set entries to empty array instead of keeping previous
        // This is important for new users who shouldn't see stale data
        setEntries([]);
      } else {
        console.log(`[useJournalEntries] Fetched ${data?.length || 0} entries`);
        
        if (data && data.length > 0) {
          console.log('[useJournalEntries] First entry sample:', {
            id: data[0].id,
            text: data[0]["refined text"],
            created: data[0].created_at
          });
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
          entities: item.entities ? (item.entities as any[]).map(entity => ({
            type: entity.type,
            name: entity.name,
            text: entity.text
          })) : undefined
        }));
        
        setEntries(typedEntries);
      }
      
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
      initialFetchDoneRef.current = true;
    } catch (error: any) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      setError('Failed to load entries: ' + error.message);
      // For new users who don't have entries yet, we want to show empty state
      // instead of an error, so we set entries to empty array
      setEntries([]);
      initialFetchDoneRef.current = true;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId, fetchCount]);

  useEffect(() => {
    if (userId) {
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
      console.log(`[useJournalEntries] Waiting for prerequisites: userId=${!!userId}`);
      if (!initialFetchDoneRef.current) {
        setLoading(userId !== undefined);
      } else {
        setLoading(false);
      }
    }
    
    // Cleanup function to clear any timeouts
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [userId, refreshKey, fetchEntries, lastRefreshKey]);

  return { 
    entries, 
    loading, 
    fetchEntries,
    lastFetchTime,
    fetchCount,
    error
  };
}
