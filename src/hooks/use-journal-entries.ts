
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
  const profileCheckAttemptsRef = useRef(0);
  const maxProfileAttempts = 3;

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const verifyUserProfile = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('[useJournalEntries] Verifying user profile:', userId);
      
      // First try checking if profile exists
      const exists = await checkUserProfile(userId);
      setProfileExists(exists);
      
      if (exists) {
        return true;
      }
      
      // If profile doesn't exist, try creating it with multiple attempts
      let profileCreated = false;
      profileCheckAttemptsRef.current++;
      
      if (profileCheckAttemptsRef.current <= maxProfileAttempts) {
        console.log(`[useJournalEntries] Profile does not exist, creating one (attempt ${profileCheckAttemptsRef.current}/${maxProfileAttempts})`);
        
        profileCreated = await createUserProfile(userId);
        setProfileExists(profileCreated);
        
        if (!profileCreated && profileCheckAttemptsRef.current < maxProfileAttempts) {
          // Wait a bit before the next attempt
          await new Promise(resolve => setTimeout(resolve, 800));
          
          console.log(`[useJournalEntries] Retrying profile creation (attempt ${profileCheckAttemptsRef.current + 1}/${maxProfileAttempts})`);
          profileCheckAttemptsRef.current++;
          
          // Try one more time
          profileCreated = await createUserProfile(userId);
          setProfileExists(profileCreated);
        }
      }
      
      return profileCreated;
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
    
    // Only check profile if not already verified and this isn't passed in as a prop
    if (profileExists === false && profileCheckAttemptsRef.current < maxProfileAttempts) {
      const created = await createUserProfile(userId);
      if (!created) {
        // Don't show error to user, just log it
        console.error('[useJournalEntries] Failed to create user profile');
      }
    } else if (profileExists === null && !isProfileChecked) {
      await verifyUserProfile(userId);
    }
    
    // Always clear errors to avoid showing them to users
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
      
      // Don't replace entries with empty array if we already have entries
      // and this fetch returned empty (could be a temporary connectivity issue)
      if (journalEntries.length > 0 || entriesRef.current.length === 0) {
        setEntries(journalEntries);
      } else {
        console.log('[useJournalEntries] Fetch returned empty but keeping existing entries');
      }
      
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
      initialFetchDoneRef.current = true;
    } catch (error: any) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      
      // Only set error if it's definitely not a profile issue
      if (!error.message?.includes('profile') && !error.message?.includes('auth')) {
        setError('Failed to load entries: ' + error.message);
      } else {
        console.log('[useJournalEntries] Suppressing profile-related error:', error.message);
      }
      
      // Don't clear entries on error if we already have entries
      if (entriesRef.current.length === 0) {
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
