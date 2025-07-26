import { useState, useEffect, useCallback, useRef } from 'react';
import { JournalEntry } from '@/types/journal';
import { checkUserProfile, createUserProfile, fetchJournalEntries } from '@/services/journalService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

type UseJournalEntriesReturn = {
  entries: JournalEntry[];
  loading: boolean;
  fetchEntries: () => Promise<void>;
  lastFetchTime: Date | null;
  fetchCount: number;
  error: string | null;
  profileExists: boolean | null;
};

// Enhanced global cache for entries with improved cache invalidation
const globalEntriesCache: {
  entries: JournalEntry[];
  lastFetchTime: Date | null;
  userId?: string;
  lastRefreshKey?: number;
  entryIds: Set<number>;
  cacheExpiryTime: number;
  lastDeletedEntryId?: number | null;
  deletedEntryIds: Set<number>; // Track all deleted entry IDs
  lastUpdatedEntryId?: number | null; // Track last updated entry for immediate refresh
} = {
  entries: [],
  lastFetchTime: null,
  entryIds: new Set(),
  cacheExpiryTime: 0, // Timestamp when cache should be considered expired
  lastDeletedEntryId: null, // Track the last deleted entry for better cache invalidation
  deletedEntryIds: new Set(), // Store all deleted entry IDs
  lastUpdatedEntryId: null // Track last updated entry
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
        (!globalEntriesCache.lastRefreshKey || globalEntriesCache.lastRefreshKey === refreshKey) &&
        Date.now() < globalEntriesCache.cacheExpiryTime) {
      // Filter out any deleted entries from the cache
      const filteredEntries = globalEntriesCache.entries.filter(
        entry => !globalEntriesCache.deletedEntryIds.has(entry.id)
      );
      console.log('[useJournalEntries] Initializing from global cache:', filteredEntries.length);
      return filteredEntries;
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
  const fetchRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deletedEntryIdRef = useRef<number | null>(null);
  const deletedEntryIdsRef = useRef<Set<number>>(new Set()); // Define a single instance of this ref
  const lastDeletedEntryIdRef = useRef<number | null>(null); // Define a single instance of this ref
  const updatedEntryIdRef = useRef<number | null>(null); // Track updated entries

  useEffect(() => {
    entriesRef.current = entries;
    
    // Update global cache when entries change with improved cache management
    if (entries.length > 0 && userId) {
      // Track unique entry IDs to prevent duplicates in the cache
      const uniqueEntries: JournalEntry[] = [];
      const seenIds = new Set<number>();
      
      for (const entry of entries) {
        // Skip any entries that are in the deleted list
        if (deletedEntryIdsRef.current.has(entry.id) || 
            globalEntriesCache.deletedEntryIds.has(entry.id)) {
          continue;
        }
        
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id);
          uniqueEntries.push(entry);
        }
      }
      
      // Check if we need to remember a deleted entry ID
      if (lastDeletedEntryIdRef.current) {
        globalEntriesCache.lastDeletedEntryId = lastDeletedEntryIdRef.current;
        lastDeletedEntryIdRef.current = null;
      }
      
      globalEntriesCache.entries = uniqueEntries;
      globalEntriesCache.userId = userId;
      globalEntriesCache.lastRefreshKey = refreshKey;
      globalEntriesCache.lastFetchTime = new Date();
      globalEntriesCache.entryIds = seenIds;
      globalEntriesCache.cacheExpiryTime = Date.now() + 60000; // Cache valid for 1 minute
      
      // Set cache validity timer - invalidate after 1 minute to ensure fresh data eventually
      if (cacheValidityTimerRef.current) {
        clearTimeout(cacheValidityTimerRef.current);
      }
      
      cacheValidityTimerRef.current = setTimeout(() => {
        console.log('[useJournalEntries] Cache validity expired, will refresh on next fetch');
        globalEntriesCache.cacheExpiryTime = 0;
      }, 60000); // 1 minute cache validity
    }
  }, [entries, userId, refreshKey]);

  useEffect(() => {
    const handleEntryDeleted = (event: CustomEvent) => {
      if (event.detail && event.detail.entryId) {
        const deletedId = Number(event.detail.entryId);
        console.log(`[useJournalEntries] Detected entry deleted event: ${deletedId}`);
        
        // Add to local deleted IDs set
        deletedEntryIdsRef.current.add(deletedId);
        
        // Add to global cache of deleted IDs
        globalEntriesCache.deletedEntryIds.add(deletedId);
        globalEntriesCache.lastDeletedEntryId = deletedId;
        
        // Update last deleted ID ref
        lastDeletedEntryIdRef.current = deletedId;
        
        // Invalidate cache immediately
        globalEntriesCache.cacheExpiryTime = 0;
        
        // Filter entries to remove the deleted one
        setEntries(currentEntries => 
          currentEntries.filter(entry => entry.id !== deletedId)
        );
      }
    };

    // New handler for entry updates
    const handleEntryUpdated = (event: CustomEvent) => {
      if (event.detail && event.detail.entryId) {
        const updatedId = Number(event.detail.entryId);
        const newContent = event.detail.newContent;
        const displayContent = event.detail.displayContent;
        const isProcessing = event.detail.isProcessing;
        
        console.log(`[useJournalEntries] Detected entry updated event: ${updatedId}`, {
          newContent: newContent?.substring(0, 50) + '...',
          displayContent: displayContent?.substring(0, 50) + '...',
          isProcessing
        });
        
        // Track the updated entry
        updatedEntryIdRef.current = updatedId;
        globalEntriesCache.lastUpdatedEntryId = updatedId;
        
        // Update the entry immediately in local state with display content
        setEntries(currentEntries => 
          currentEntries.map(entry => {
            if (entry.id === updatedId) {
              return {
                ...entry,
                content: displayContent || newContent || entry.content,
                'refined text': newContent || entry['refined text'],
                'transcription text': newContent || entry['transcription text'],
                Edit_Status: 1,
                // Reset analysis data as it will be reprocessed
                sentiment: isProcessing ? null : entry.sentiment,
                emotions: isProcessing ? null : entry.emotions,
                master_themes: isProcessing ? [] : entry.master_themes,
                entities: isProcessing ? [] : entry.entities
              };
            }
            return entry;
          })
        );
        
        // Invalidate cache to force fresh fetch for updated analysis
        globalEntriesCache.cacheExpiryTime = 0;
        
        // Schedule a refresh to get updated analysis data
        setTimeout(() => {
          if (!isFetchingRef.current) {
            console.log(`[useJournalEntries] Fetching updated analysis for entry: ${updatedId}`);
            fetchEntries();
          }
        }, 2000);
      }
    };
    
    window.addEventListener('journalEntryDeleted', handleEntryDeleted as EventListener);
    window.addEventListener('journalEntryUpdated', handleEntryUpdated as EventListener);
    
    return () => {
      window.removeEventListener('journalEntryDeleted', handleEntryDeleted as EventListener);
      window.removeEventListener('journalEntryUpdated', handleEntryUpdated as EventListener);
    };
  }, []);

  // IMPORTANT: Fix for the TypeScript error - Declare verifyUserProfile before fetchEntries
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

  // IMPORTANT: Fix - Declare fetchEntries after verifyUserProfile
  const fetchEntries = useCallback(async () => {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    if (!userId) {
      console.log('[useJournalEntries] DEBUG: No user ID provided for fetching entries:', {
        isNative,
        timestamp: new Date().toISOString()
      });
      setLoading(false);
      setEntries([]);
      initialFetchDoneRef.current = true;
      return;
    }
    
    // IMPROVED FIX: Better logging and state management during fetch
    console.log('[useJournalEntries] DEBUG: Starting fetch with details:', {
      currentlyFetching: isFetchingRef.current,
      cachedEntries: globalEntriesCache.entries.length,
      refreshKey,
      userId,
      isNative,
      isProfileChecked,
      profileExists,
      timestamp: new Date().toISOString()
    });
    
    // Check if there was a recently deleted or updated entry ID
    const hasRecentDeletion = globalEntriesCache.lastDeletedEntryId !== null || 
                             lastDeletedEntryIdRef.current !== null;
    const hasRecentUpdate = globalEntriesCache.lastUpdatedEntryId !== null ||
                           updatedEntryIdRef.current !== null;
    
    // Cache invalidation logic - always invalidate cache if there was a deletion or update
    if (hasRecentDeletion || hasRecentUpdate) {
      console.log('[useJournalEntries] Cache invalidated due to deletion or update');
      globalEntriesCache.cacheExpiryTime = 0;
    }
    
    // Check if this is a duplicate fetch with the same parameters
    const isDuplicateFetch = 
      isFetchingRef.current && 
      previousFetchParamsRef.current.userId === userId && 
      previousFetchParamsRef.current.refreshKey === refreshKey &&
      globalEntriesCache.userId === userId && 
      globalEntriesCache.entries.length > 0 &&
      globalEntriesCache.lastRefreshKey === refreshKey &&
      Date.now() < globalEntriesCache.cacheExpiryTime &&
      !hasRecentDeletion &&
      !hasRecentUpdate;
    
    if (isDuplicateFetch) {
      console.log('[useJournalEntries] Skipping duplicate fetch with same parameters');
      return;
    }
    
    // Update previous fetch params
    previousFetchParamsRef.current = { userId, refreshKey };
    
    // CRITICAL IMPROVEMENT: Immediately show cached data while fetching fresh data
    if (globalEntriesCache.userId === userId && 
        globalEntriesCache.entries.length > 0 &&
        !hasRecentDeletion) {
      // Filter out deleted entries from the cached data we're showing
      const filteredCachedEntries = globalEntriesCache.entries.filter(entry => 
        !deletedEntryIdsRef.current.has(entry.id) &&
        !globalEntriesCache.deletedEntryIds.has(entry.id)
      );
      
      console.log('[useJournalEntries] Using filtered cached entries while fetching fresh data:', 
                 filteredCachedEntries.length);
      setEntries(filteredCachedEntries);
      
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
      if (globalEntriesCache.entries.length === 0 || 
          globalEntriesCache.userId !== userId || 
          hasRecentDeletion ||
          hasRecentUpdate) {
        setLoading(true);
      }
      
      console.log(`[useJournalEntries] DEBUG: Initiating database fetch:`, {
        userId,
        fetchNumber: fetchCount + 1,
        isNative,
        hasCache: globalEntriesCache.entries.length > 0,
        cacheValid: Date.now() < globalEntriesCache.cacheExpiryTime,
        profileExists,
        isProfileChecked
      });
      
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
      }, 8000); // 8 seconds for longer recordings
      
      const journalEntries = await fetchJournalEntries(userId, fetchTimeoutRef);
      
      // Filter out any entries that have been deleted
      const filteredEntries = journalEntries.filter(entry => 
        !deletedEntryIdsRef.current.has(entry.id) &&
        !globalEntriesCache.deletedEntryIds.has(entry.id)
      );
      
      console.log(`[useJournalEntries] Fetched ${journalEntries.length} entries, filtered to ${filteredEntries.length} after removing deleted entries`);
      
      if (journalEntries.length === 0) {
        consecutiveEmptyFetchesRef.current += 1;
        
        // If we get multiple empty responses, try once more after a delay
        if (consecutiveEmptyFetchesRef.current >= 2) {
          if (fetchRetryTimerRef.current) clearTimeout(fetchRetryTimerRef.current);
          
          fetchRetryTimerRef.current = setTimeout(() => {
            console.log('[useJournalEntries] Retrying fetch after multiple empty responses');
            fetchEntries();
          }, 1500);
        }
      } else {
        consecutiveEmptyFetchesRef.current = 0;
      }
      
      // Special handling for post-deletion refreshes to ensure freshness
      if (deletedEntryIdRef.current) {
        const deletedId = deletedEntryIdRef.current;
        console.log(`[useJournalEntries] Post-deletion check for ID: ${deletedId}`);
        
        // Check if the deleted entry is still in the fetched results
        const stillExists = journalEntries.some(entry => entry.id === deletedId);
        
        if (stillExists) {
          console.log(`[useJournalEntries] Deleted entry ${deletedId} still found in results, will filter it out`);
          // Filter out the entry that should be deleted
          const filteredEntries = journalEntries.filter(entry => entry.id !== deletedId);
          
          // Update global cache
          globalEntriesCache.lastDeletedEntryId = deletedId;
          
          // Set the filtered entries
          setEntries(filteredEntries);
          setLastFetchTime(new Date());
          setFetchCount(prev => prev + 1);
          
          // Clear the ref to avoid re-filtering on next fetch
          deletedEntryIdRef.current = null;
          
          // Schedule one more fetch after a delay to ensure database consistency
          setTimeout(() => {
            console.log(`[useJournalEntries] Scheduling follow-up fetch after deletion`);
            fetchEntries();
          }, 2000);
          
          return;
        } else {
          console.log(`[useJournalEntries] Confirmed entry ${deletedId} is no longer in results`);
          deletedEntryIdRef.current = null;
          globalEntriesCache.lastDeletedEntryId = null;
        }
      }
      
      // Special handling for updated entries - merge with fresh data
      if (updatedEntryIdRef.current) {
        const updatedId = updatedEntryIdRef.current;
        console.log(`[useJournalEntries] Post-update refresh for ID: ${updatedId}`);
        
        // Find the updated entry in fresh data
        const updatedEntry = journalEntries.find(entry => entry.id === updatedId);
        
        if (updatedEntry) {
          console.log(`[useJournalEntries] Found updated entry ${updatedId} with fresh analysis data`);
          
          // Update the entry in our current entries with fresh analysis
          setEntries(currentEntries => 
            currentEntries.map(entry => {
              if (entry.id === updatedId) {
                return {
                  ...entry,
                  ...updatedEntry,
                  // Preserve display content if it was translated
                  content: entry.content // Keep the display content user is currently seeing
                };
              }
              return entry;
            })
          );
          
          // Clear the ref to avoid re-processing
          updatedEntryIdRef.current = null;
          globalEntriesCache.lastUpdatedEntryId = null;
        }
      }
      
      // Deduplicate entries
      const uniqueEntries: JournalEntry[] = [];
      const uniqueIds = new Set<number>();
      
      for (const entry of journalEntries) {
        if (!uniqueIds.has(entry.id)) {
          uniqueIds.add(entry.id);
          uniqueEntries.push(entry);
        }
      }
      
      // Save successful fetch for recovery
      lastSuccessfulFetchRef.current = uniqueEntries;
      
      // Update global cache with fresh entries - with improved settings
      globalEntriesCache.entries = uniqueEntries;
      globalEntriesCache.userId = userId;
      globalEntriesCache.lastFetchTime = new Date();
      globalEntriesCache.lastRefreshKey = refreshKey;
      globalEntriesCache.entryIds = uniqueIds;
      globalEntriesCache.cacheExpiryTime = Date.now() + 60000; // Cache valid for 1 minute
      
      // IMPROVED FIX: Don't replace entries with empty array if we already have entries
      // and this fetch returned empty (could be a temporary connectivity issue)
      if (uniqueEntries.length > 0 || entriesRef.current.length === 0) {
        console.log('[useJournalEntries] Setting entries:', uniqueEntries.length);
        setEntries(uniqueEntries);
        entryIdsSet.current = uniqueIds;
      } else if (uniqueEntries.length === 0 && entriesRef.current.length > 0) {
        // If we got an empty response but have existing entries, check if it's likely a race condition
        const timeSinceLastFetch = globalEntriesCache.lastFetchTime ? 
                                  Date.now() - globalEntriesCache.lastFetchTime.getTime() : 0;
                                  
        if (timeSinceLastFetch < 5000) { // If less than 5 seconds since last fetch
          console.log('[useJournalEntries] Fetch returned empty during likely race condition, keeping existing entries');
          // Keep existing entries as they're likely more up-to-date during active processing
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
  }, [userId, fetchCount, profileExists, verifyUserProfile, isProfileChecked, refreshKey]);

  // Listen for processing entries changes to trigger fetches
  useEffect(() => {
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (!event.detail || !Array.isArray(event.detail.entries)) return;
      
      const newProcessingEntries = event.detail.entries;
      const prevProcessingEntries = lastProcessingEntriesRef.current;
      
      // Check if force update flag is set
      const forceUpdate = event.detail.forceUpdate === true;
      
      // If processing entries have changed and we have new entries, fetch data
      if (forceUpdate || newProcessingEntries.length !== prevProcessingEntries.length) {
        console.log('[useJournalEntries] Processing entries changed, scheduling fetch');
        
        lastProcessingEntriesRef.current = newProcessingEntries;
        
        // If we have a new processing entry, fetch after short delay
        if (newProcessingEntries.length > prevProcessingEntries.length) {
          setTimeout(() => {
            fetchEntries();
          }, 1000);
        }
        
        // If we have fewer processing entries (completed), fetch immediately
        if (newProcessingEntries.length < prevProcessingEntries.length) {
          // Force cache to expire
          globalEntriesCache.cacheExpiryTime = 0;
          
          // Multiple retries for better reliability
          for (let i = 0; i < 2; i++) {
            setTimeout(() => {
              if (!isFetchingRef.current) fetchEntries();
            }, 300 + (i * 800));
          }
        }
      }
    };
    
    window.addEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    
    return () => {
      window.removeEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    };
  }, [fetchEntries]);

  // Listen for events requesting immediate refresh
  useEffect(() => {
    const handleJournalEntriesRefresh = (event: CustomEvent) => {
      if (!userId || !event.detail) return;
      
      console.log(`[useJournalEntries] Detected refresh request, will fetch new data:`, event.detail);
      
      // Track deleted entry ID if this is a delete action
      if (event.detail.action === 'delete' && event.detail.entryId) {
        console.log(`[useJournalEntries] Tracking deleted entry ID: ${event.detail.entryId}`);
        deletedEntryIdRef.current = event.detail.entryId;
      }
      
      // For delete operations, filter out the deleted entry instantly for a smoother experience
      if (event.detail.action === 'delete' && event.detail.entryId) {
        setEntries(prevEntries => prevEntries.filter(entry => entry.id !== event.detail.entryId));
      }
      
      // Force cache to expire
      globalEntriesCache.cacheExpiryTime = 0;
      
      // Immediately try to fetch fresh data
      if (!isFetchingRef.current) {
        // Short delay to allow the database to settle
        setTimeout(() => {
          fetchEntries();
        }, 300);
      }
    };
    
    window.addEventListener('journalEntriesNeedRefresh', handleJournalEntriesRefresh as EventListener);
    
    return () => {
      window.removeEventListener('journalEntriesNeedRefresh', handleJournalEntriesRefresh as EventListener);
    };
  }, [userId, fetchEntries]);

  // Listen for processing entry events to trigger proactive fetches
  useEffect(() => {
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (!event.detail || !event.detail.entryId) return;
      
      console.log(`[useJournalEntries] Detected entry mapping, will fetch new data:`, event.detail.entryId);
      
      // Force cache to expire
      globalEntriesCache.cacheExpiryTime = 0;
      
      // Immediately try to fetch fresh data when an entry is mapped
      if (userId && !isFetchingRef.current) {
        // Short delay to allow the database to settle
        setTimeout(() => {
          fetchEntries();
        }, 300);
      }
    };
    
    // Also listen for entry completion events
    const handleProcessingEntryCompleted = (event: CustomEvent) => {
      if (!event.detail || !event.detail.tempId) return;
      
      console.log(`[useJournalEntries] Detected entry completion, will fetch new data:`, event.detail.tempId);
      
      // Force cache to expire
      globalEntriesCache.cacheExpiryTime = 0;
      
      // Immediately try to fetch fresh data when an entry is completed
      if (userId && !isFetchingRef.current) {
        // Multiple retries for better reliability
        for (let i = 0; i < 2; i++) {
          setTimeout(() => {
            if (!isFetchingRef.current) fetchEntries();
          }, 500 + (i * 1000));
        }
      }
    };
    
    window.addEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    window.addEventListener('processingEntryCompleted', handleProcessingEntryCompleted as EventListener);
    
    return () => {
      window.removeEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
      window.removeEventListener('processingEntryCompleted', handleProcessingEntryCompleted as EventListener);
    };
  }, [userId, fetchEntries]);

  useEffect(() => {
    if (userId) {
      const isInitialLoad = !initialFetchDoneRef.current;
      const hasRefreshKeyChanged = refreshKey !== lastRefreshKey;
      const forceCacheRefresh = globalEntriesCache.lastDeletedEntryId !== null || 
                               deletedEntryIdRef.current !== null;
      const shouldFetchFresh = isInitialLoad || 
                              hasRefreshKeyChanged || 
                              Date.now() >= globalEntriesCache.cacheExpiryTime ||
                              forceCacheRefresh;
      
      if (shouldFetchFresh) {
        console.log(`[useJournalEntries] Effect triggered: initial=${isInitialLoad}, refreshKey changed=${hasRefreshKeyChanged}, forceCacheRefresh=${forceCacheRefresh}`);
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
      if (fetchRetryTimerRef.current) {
        clearTimeout(fetchRetryTimerRef.current);
      }
    };
  }, [userId, refreshKey, fetchEntries, lastRefreshKey]);

  return {
    entries: entries.filter(entry => 
      !deletedEntryIdsRef.current.has(entry.id) &&
      !globalEntriesCache.deletedEntryIds.has(entry.id)
    ),
    loading,
    fetchEntries,
    lastFetchTime,
    fetchCount,
    error,
    profileExists
  };
}
