import { useState, useEffect, useCallback, useRef } from 'react';
import { JournalEntry } from '@/types/journal';
import { checkUserProfile, createUserProfile, fetchJournalEntries } from '@/services/journalService';

interface UseJournalEntriesReturn {
  entries: JournalEntry[];
  loading: boolean;
  fetchEntries: () => Promise<void>;
  error: string | null;
  profileExists: boolean | null;
}

export function useJournalEntriesSimplified(
  userId: string | undefined, 
  refreshKey: number
): UseJournalEntriesReturn {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  
  const isFetchingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!userId || isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      // First ensure profile exists
      console.log('[useJournalEntriesSimplified] Checking user profile for:', userId);
      let profileExistsResult = await checkUserProfile(userId);
      
      if (!profileExistsResult) {
        console.log('[useJournalEntriesSimplified] Profile does not exist, creating one');
        const created = await createUserProfile(userId);
        if (!created) {
          throw new Error('Failed to create user profile');
        }
        profileExistsResult = true;
      }
      
      setProfileExists(profileExistsResult);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout for fetch operation
      timeoutRef.current = setTimeout(() => {
        if (isFetchingRef.current) {
          console.log('[useJournalEntriesSimplified] Fetch timeout, stopping loading');
          setLoading(false);
          isFetchingRef.current = false;
        }
      }, 10000);

      console.log('[useJournalEntriesSimplified] Fetching entries for user:', userId);
      const journalEntries = await fetchJournalEntries(userId, timeoutRef);
      
      console.log(`[useJournalEntriesSimplified] Fetched ${journalEntries.length} entries`);
      setEntries(journalEntries);
      
    } catch (err: any) {
      console.error('[useJournalEntriesSimplified] Error:', err);
      setError(err.message || 'Failed to load entries');
      // Don't clear entries on error - keep what we have
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [userId]);

  // Initial fetch when user ID changes
  useEffect(() => {
    if (userId) {
      fetchEntries();
    } else {
      setLoading(false);
      setEntries([]);
    }
  }, [userId, refreshKey, fetchEntries]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      if (userId && !isFetchingRef.current) {
        console.log('[useJournalEntriesSimplified] Refresh event received');
        fetchEntries();
      }
    };

    window.addEventListener('journalEntriesNeedRefresh', handleRefresh);
    return () => window.removeEventListener('journalEntriesNeedRefresh', handleRefresh);
  }, [userId, fetchEntries]);

  // Listen for processing completion
  useEffect(() => {
    const handleProcessingComplete = () => {
      if (userId && !isFetchingRef.current) {
        console.log('[useJournalEntriesSimplified] Processing complete, refreshing');
        setTimeout(() => fetchEntries(), 1000);
      }
    };

    window.addEventListener('processingEntryCompleted', handleProcessingComplete);
    return () => window.removeEventListener('processingEntryCompleted', handleProcessingComplete);
  }, [userId, fetchEntries]);

  return {
    entries,
    loading,
    fetchEntries,
    error,
    profileExists
  };
}
