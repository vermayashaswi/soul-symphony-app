import { useState, useEffect, useCallback, useRef } from 'react';
import { JournalEntry } from '@/components/journal/JournalEntryCard';
import { checkUserProfile, createUserProfile, fetchJournalEntries } from '@/services/journalService';

type UseJournalEntriesReturn = {
  entries: JournalEntry[];
  loading: boolean;
  fetchEntries: () => Promise<void>;
  lastFetchTime: Date | null;
  fetchCount: number;
  error: string | null;
  profileExists: boolean | null;
};

export function useJournalEntries(
  userId: string | undefined, 
  refreshKey: number, 
  isProfileChecked: boolean = false
): UseJournalEntriesReturn {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchCount, setFetchCount] = useState(0);
  const [lastRefreshKey, setLastRefreshKey] = useState(refreshKey);
  const [error, setError] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  
  const isFetchingRef = useRef(false);
  const initialFetchDoneRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveEmptyFetchesRef = useRef(0);

  const verifyUserProfile = useCallback(async (userId: string) => {
    const exists = await checkUserProfile(userId);
    setProfileExists(exists);
    
    if (!exists) {
      const created = await createUserProfile(userId);
      setProfileExists(created);
      return created;
    }
    
    return exists;
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      console.log('[useJournalEntries] No user ID provided for fetching entries');
      setLoading(false);
      setEntries([]);
      initialFetchDoneRef.current = true;
      return;
    }
    
    console.log('[useJournalEntries] Starting fetch, currently fetching:', isFetchingRef.current);
    
    if (profileExists === false) {
      const created = await createUserProfile(userId);
      if (!created) {
        setLoading(false);
        setError('Failed to create user profile');
        return;
      }
    } else if (profileExists === null && !isProfileChecked) {
      const exists = await verifyUserProfile(userId);
      if (!exists) {
        setLoading(false);
        setError('Failed to create user profile');
        return;
      }
    }
    
    setError(null);
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      
      console.log(`[useJournalEntries] Fetching entries for user ID: ${userId} (fetch #${fetchCount + 1})`);
      
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      fetchTimeoutRef.current = setTimeout(() => {
        if (isFetchingRef.current) {
          console.log('[useJournalEntries] Fetch is taking too long, setting loading to false');
          setLoading(false);
          initialFetchDoneRef.current = true;
        }
      }, 5000);
      
      const journalEntries = await fetchJournalEntries(userId, fetchTimeoutRef);
      
      if (journalEntries.length === 0) {
        consecutiveEmptyFetchesRef.current += 1;
      } else {
        consecutiveEmptyFetchesRef.current = 0;
      }
      
      setEntries(journalEntries);
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
      initialFetchDoneRef.current = true;
    } catch (error: any) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      setError('Failed to load entries: ' + error.message);
      
      if (entries.length === 0) {
        setEntries([]);
      }
      
      initialFetchDoneRef.current = true;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId, fetchCount, profileExists, verifyUserProfile, entries, isProfileChecked]);

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
    error,
    profileExists
  };
}
