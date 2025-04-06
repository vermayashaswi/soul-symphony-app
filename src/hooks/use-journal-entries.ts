
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
  const entriesRef = useRef<JournalEntry[]>([]);
  const lastSuccessfulFetchRef = useRef<JournalEntry[]>([]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const verifyUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('[useJournalEntries] Verifying user profile:', userId);
      const exists = await checkUserProfile(userId);
      setProfileExists(exists);
      
      if (!exists) {
        console.log('[useJournalEntries] Profile does not exist, creating one');
        const created = await createUserProfile(userId);
        setProfileExists(created);
        return created;
      }
      
      return exists;
    } catch (error) {
      console.error('[useJournalEntries] Error verifying user profile:', error);
      return false;
    }
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
    if (isFetchingRef.current) {
      console.log('[useJournalEntries] Already fetching, skipping this request');
      return;
    }
    
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
      
      // Set a timeout to avoid showing loading indefinitely
      fetchTimeoutRef.current = setTimeout(() => {
        if (isFetchingRef.current) {
          console.log('[useJournalEntries] Fetch is taking too long, setting loading to false');
          setLoading(false);
          initialFetchDoneRef.current = true;
          isFetchingRef.current = false;
        }
      }, 5000);
      
      const journalEntries = await fetchJournalEntries(userId, fetchTimeoutRef);
      
      if (journalEntries.length === 0) {
        consecutiveEmptyFetchesRef.current += 1;
      } else {
        consecutiveEmptyFetchesRef.current = 0;
      }
      
      // Save successful fetch for recovery
      lastSuccessfulFetchRef.current = journalEntries;
      
      // Don't replace entries with empty array if we already have entries
      // and this fetch returned empty (could be a temporary connectivity issue)
      if (journalEntries.length > 0 || entriesRef.current.length === 0) {
        console.log('[useJournalEntries] Setting entries:', journalEntries.length);
        setEntries(journalEntries);
      } else {
        console.log('[useJournalEntries] Fetch returned empty but keeping existing entries');
      }
      
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
      initialFetchDoneRef.current = true;
    } catch (error: any) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      setError('Failed to load entries: ' + error.message);
      
      // On error, if we have a last successful fetch, use that
      if (lastSuccessfulFetchRef.current.length > 0) {
        console.log('[useJournalEntries] Using last successful fetch:', lastSuccessfulFetchRef.current.length);
        setEntries(lastSuccessfulFetchRef.current);
      } else if (entriesRef.current.length === 0) {
        setEntries([]);
      }
      
      initialFetchDoneRef.current = true;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId, fetchCount, profileExists, verifyUserProfile, isProfileChecked]);

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
        setLoading(userId !== undefined); // Only show loading if userId is defined but falsy
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
