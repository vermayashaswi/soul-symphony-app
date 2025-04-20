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

const globalEntriesCache: {
  entries: JournalEntry[];
  lastFetchTime: Date | null;
  userId?: string;
  lastRefreshKey?: number;
  entryIds: Set<number>;
} = {
  entries: [],
  lastFetchTime: null,
  entryIds: new Set()
};

export function useJournalEntries(
  userId: string | undefined, 
  refreshKey: number, 
  isProfileChecked: boolean = false
): UseJournalEntriesReturn {
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
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
  const lastProcessingEntriesRef = useRef<string[]>([]);
  const previousFetchParamsRef = useRef<{ userId?: string, refreshKey: number }>({ refreshKey });
  const entryIdsSet = useRef<Set<number>>(new Set());

  useEffect(() => {
    entriesRef.current = entries;
    
    if (entries.length > 0 && userId) {
      const uniqueEntries: JournalEntry[] = [];
      const seenIds = new Set<number>();
      
      for (const entry of entries) {
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id);
          uniqueEntries.push(entry);
        }
      }
      
      globalEntriesCache.entries = uniqueEntries;
      globalEntriesCache.userId = userId;
      globalEntriesCache.lastRefreshKey = refreshKey;
      globalEntriesCache.lastFetchTime = new Date();
      globalEntriesCache.entryIds = seenIds;
      
      if (cacheValidityTimerRef.current) {
        clearTimeout(cacheValidityTimerRef.current);
      }
      
      cacheValidityTimerRef.current = setTimeout(() => {
        console.log('[useJournalEntries] Cache validity expired, will refresh on next fetch');
        globalEntriesCache.lastRefreshKey = undefined;
      }, 120000);
    }
  }, [entries, userId, refreshKey]);

  useEffect(() => {
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (!event.detail || !event.detail.entryId) return;
      
      console.log(`[useJournalEntries] Detected entry mapping, will fetch new data:`, event.detail.entryId);
      
      if (userId && !isFetchingRef.current) {
        setTimeout(() => {
          fetchEntries();
        }, 300);
      }
    };
    
    window.addEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    
    return () => {
      window.removeEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    };
  }, [userId]);

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
    
    console.log('[useJournalEntries] Starting fetch, currently fetching:', isFetchingRef.current, 
                'cached entries:', globalEntriesCache.entries.length,
                'refreshKey:', refreshKey);
    
    const isDuplicateFetch = 
      isFetchingRef.current && 
      previousFetchParamsRef.current.userId === userId && 
      previousFetchParamsRef.current.refreshKey === refreshKey &&
      globalEntriesCache.userId === userId && 
      globalEntriesCache.entries.length > 0 &&
      globalEntriesCache.lastRefreshKey === refreshKey &&
      Date.now() - (globalEntriesCache.lastFetchTime?.getTime() || 0) < 500;
    
    if (isDuplicateFetch) {
      console.log('[useJournalEntries] Skipping duplicate fetch with same parameters');
      return;
    }
    
    previousFetchParamsRef.current = { userId, refreshKey };
    
    if (globalEntriesCache.userId === userId && globalEntriesCache.entries.length > 0) {
      console.log('[useJournalEntries] Using cached entries while fetching fresh data');
      setEntries(globalEntriesCache.entries);
      
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
      
      if (globalEntriesCache.entries.length === 0 || globalEntriesCache.userId !== userId) {
        setLoading(true);
      }
      
      console.log(`[useJournalEntries] Fetching entries for user ID: ${userId} (fetch #${fetchCount + 1})`);
      
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      fetchTimeoutRef.current = setTimeout(() => {
        if (isFetchingRef.current) {
          console.log('[useJournalEntries] Fetch is taking too long, setting loading to false');
          setLoading(false);
          initialFetchDoneRef.current = true;
          isFetchingRef.current = false;
        }
      }, 8000);
      
      const journalEntries = await fetchJournalEntries(userId, fetchTimeoutRef);
      
      if (journalEntries.length === 0) {
        consecutiveEmptyFetchesRef.current += 1;
      } else {
        consecutiveEmptyFetchesRef.current = 0;
      }
      
      const convertedEntries: JournalEntry[] = journalEntries.map(entry => ({
        ...entry,
        content: entry.content || entry["refined text"] || entry["transcription text"] || "",
        id: entry.id,
        created_at: entry.created_at,
        foreignKey: entry.foreignKey || entry["foreign key"],
        themes: entry.themes || entry.master_themes
      }));
      
      const uniqueEntries: JournalEntry[] = [];
      const uniqueIds = new Set<number>();
      
      for (const entry of convertedEntries) {
        if (!uniqueIds.has(entry.id)) {
          uniqueIds.add(entry.id);
          uniqueEntries.push(entry);
        }
      }
      
      globalEntriesCache.entries = uniqueEntries;
      globalEntriesCache.userId = userId;
      globalEntriesCache.lastFetchTime = new Date();
      globalEntriesCache.lastRefreshKey = refreshKey;
      globalEntriesCache.entryIds = uniqueIds;
      
      if (uniqueEntries.length > 0 || entriesRef.current.length === 0) {
        console.log('[useJournalEntries] Setting entries:', uniqueEntries.length);
        setEntries(uniqueEntries);
        entryIdsSet.current = uniqueIds;
      } else if (uniqueEntries.length === 0 && entriesRef.current.length > 0) {
        const timeSinceLastFetch = globalEntriesCache.lastFetchTime ? 
                                  Date.now() - globalEntriesCache.lastFetchTime.getTime() : 0;
                                  
        if (timeSinceLastFetch < 5000) {
          console.log('[useJournalEntries] Fetch returned empty during likely race condition, keeping existing entries');
        } else {
          console.log('[useJournalEntries] Fetch returned empty but keeping existing entries');
        }
      }
      
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
      initialFetchDoneRef.current = true;
    } catch (error: any) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      setError('Failed to load entries: ' + error.message);
      
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
  }, [userId, fetchCount, profileExists, verifyUserProfile, isProfileChecked, refreshKey]);

  useEffect(() => {
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (!event.detail || !Array.isArray(event.detail.entries)) return;
      
      const newProcessingEntries = event.detail.entries;
      const prevProcessingEntries = lastProcessingEntriesRef.current;
      
      if (newProcessingEntries.length !== prevProcessingEntries.length) {
        console.log('[useJournalEntries] Processing entries changed, scheduling fetch');
        
        lastProcessingEntriesRef.current = newProcessingEntries;
        
        if (newProcessingEntries.length > prevProcessingEntries.length) {
          setTimeout(() => {
            fetchEntries();
          }, 1000);
        }
      }
    };
    
    window.addEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    
    return () => {
      window.removeEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    };
  }, [fetchEntries]);

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
        if (globalEntriesCache.userId === userId && globalEntriesCache.entries.length > 0) {
          setLoading(false);
        }
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
