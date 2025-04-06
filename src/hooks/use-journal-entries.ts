import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
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
    // Check if profile exists
    const exists = await checkUserProfile(userId);
    setProfileExists(exists);
    
    // If not exists, create it
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
    
    // Don't check if we're currently fetching to allow forced refreshes
    console.log('[useJournalEntries] Starting fetch, currently fetching:', isFetchingRef.current);
    
    // Check if profile exists and create if needed
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
    
    // Clear any previous errors
    setError(null);
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      
      console.log(`[useJournalEntries] Fetching entries for user ID: ${userId} (fetch #${fetchCount + 1})`);
      
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
      }, 5000); // Reduce timeout to 5 seconds for better UI responsiveness
      
      // Fetch journal entries
      const journalEntries = await fetchJournalEntries(userId, fetchTimeoutRef);
      
      // If we got new entries after previously having none, show a success toast
      if (entries.length === 0 && journalEntries.length > 0 && initialFetchDoneRef.current) {
        toast.success('New journal entry added!');
        consecutiveEmptyFetchesRef.current = 0;
      } else if (journalEntries.length === 0) {
        // Track consecutive empty fetches for new users
        consecutiveEmptyFetchesRef.current += 1;
      } else {
        consecutiveEmptyFetchesRef.current = 0;
      }
      
      // Check if we have new entries compared to last fetch
      const prevEntryIds = new Set(entries.map(e => e.id));
      const newEntries = journalEntries.filter(e => !prevEntryIds.has(e.id));
      
      if (newEntries.length > 0 && initialFetchDoneRef.current && entries.length > 0) {
        console.log(`[useJournalEntries] Found ${newEntries.length} new entries!`);
        // New entry has been added after initial load
        toast.success('New journal entry processed!');
      }
      
      setEntries(journalEntries);
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
      initialFetchDoneRef.current = true;
    } catch (error: any) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      setError('Failed to load entries: ' + error.message);
      
      // If we already had entries, keep showing them
      if (entries.length === 0) {
        setEntries([]);
      }
      
      initialFetchDoneRef.current = true;
      
      // Only show toast error on initial load and if it's not just "No rows returned"
      if (!initialFetchDoneRef.current && !error.message?.includes('No rows returned')) {
        toast.error('Failed to load journal entries. Please try again later.');
      }
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
    error,
    profileExists
  };
}
