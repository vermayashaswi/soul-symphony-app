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

// IMPROVED FIX: Enhanced global cache for entries with improved cache invalidation
const globalEntriesCache: {
  entries: JournalEntry[];
  lastFetchTime: Date | null;
  userId?: string;
  lastRefreshKey?: number;
} = {
  entries: [],
  lastFetchTime: null
};

export function useJournalEntries(
  userId: string | undefined, 
  refreshKey: number, 
  isProfileChecked: boolean = false
): UseJournalEntriesReturn {
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    // Enhanced initialization from cache with refreshKey validation
    if (globalEntriesCache.userId === userId && 
        globalEntriesCache.entries.length > 0 &&
        (!globalEntriesCache.lastRefreshKey || globalEntriesCache.lastRefreshKey === refreshKey)) {
      console.log('[useJournalEntries] Initializing from global cache:', globalEntriesCache.entries.length);
      return globalEntriesCache.entries;
    }
    return [];
  });
  
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(() => globalEntriesCache.lastFetchTime);
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
  const cacheInitializedRef = useRef(false);
  const cacheValidityTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    entriesRef.current = entries;
    
    // Update global cache when entries change with improved cache management
    if (entries.length > 0 && userId) {
      globalEntriesCache.entries = entries;
      globalEntriesCache.userId = userId;
      globalEntriesCache.lastRefreshKey = refreshKey;
      globalEntriesCache.lastFetchTime = new Date();
      
      // Set cache validity timer - invalidate after 2 minutes to ensure fresh data eventually
      if (cacheValidityTimerRef.current) {
        clearTimeout(cacheValidityTimerRef.current);
      }
      
      cacheValidityTimerRef.current = setTimeout(() => {
        console.log('[useJournalEntries] Cache validity expired, will refresh on next fetch');
        globalEntriesCache.lastRefreshKey = undefined;
      }, 120000); // 2 minutes cache validity
    }
  }, [entries, userId, refreshKey]);

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
    
    // IMPROVED FIX: Better logging and state management during fetch
    console.log('[useJournalEntries] Starting fetch, currently fetching:', isFetchingRef.current, 
                'cached entries:', globalEntriesCache.entries.length,
                'refreshKey:', refreshKey);
    
    if (isFetchingRef.current) {
      console.log('[useJournalEntries] Already fetching, skipping this request');
      return;
    }
    
    // CRITICAL IMPROVEMENT: Immediately show cached data while fetching fresh data
    if (globalEntriesCache.userId === userId && globalEntriesCache.entries.length > 0) {
      console.log('[useJournalEntries] Using cached entries while fetching fresh data');
      setEntries(globalEntriesCache.entries);
      
      // Only show loading indicator for initial loads, not refreshes with existing data
      if (!cacheInitializedRef.current) {
        setLoading(false);
        cacheInitializedRef.current = true;
      }
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
      
      // Only show loading if we have no cached data
      if (globalEntriesCache.entries.length === 0 || globalEntriesCache.userId !== userId) {
        setLoading(true);
      }
      
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
      }, 8000); // Increased from 5000ms to 8000ms for longer recordings
      
      const journalEntries = await fetchJournalEntries(userId, fetchTimeoutRef);
      
      if (journalEntries.length === 0) {
        consecutiveEmptyFetchesRef.current += 1;
      } else {
        consecutiveEmptyFetchesRef.current = 0;
      }
      
      // Save successful fetch for recovery
      lastSuccessfulFetchRef.current = journalEntries;
      
      // Update global cache with fresh entries - with improved settings
      globalEntriesCache.entries = journalEntries;
      globalEntriesCache.userId = userId;
      globalEntriesCache.lastFetchTime = new Date();
      globalEntriesCache.lastRefreshKey = refreshKey;
      
      // IMPROVED FIX: Don't replace entries with empty array if we already have entries
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
      const shouldFetchFresh = isInitialLoad || hasRefreshKeyChanged;
      
      if (shouldFetchFresh) {
        console.log(`[useJournalEntries] Effect triggered: initial=${isInitialLoad}, refreshKey changed=${hasRefreshKeyChanged}`);
        fetchEntries();
        setLastRefreshKey(refreshKey);
      } else {
        console.log(`[useJournalEntries] Skipping unnecessary fetch`);
        // Even if skipping fetch, still mark as not loading if we have cached data
        if (globalEntriesCache.userId === userId && globalEntriesCache.entries.length > 0) {
          setLoading(false);
        }
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
