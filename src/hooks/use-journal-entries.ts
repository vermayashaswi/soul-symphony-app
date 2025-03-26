import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { JournalEntry } from '@/types/journal';
import { testDatabaseConnection } from '@/utils/supabase-connection';
import { generateThemesForEntry } from '@/utils/theme-generation';
import { 
  fetchJournalEntries,
  saveJournalEntry as saveToDB,
  deleteJournalEntry as deleteFromDB,
  processUnprocessedEntries as processEntries
} from '@/services/journal-entry-service';

export function useJournalEntries(userId: string | undefined, refreshKey: number = 0) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastRetryTime, setLastRetryTime] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'checking' | 'error'>('checking');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY = 3000;
  const CONNECTION_TIMEOUT = 5000;

  const checkDatabaseConnection = useCallback(async () => {
    console.log('Testing database connection...');
    try {
      const connectionTest = await testDatabaseConnection();
      
      if (!connectionTest.success) {
        console.log('Database health check failed');
        setConnectionStatus('error');
        setLoadError('Connection to database failed');
        return false;
      }
      
      console.log('Database connection test successful');
      setConnectionStatus('connected');
      setLoadError(null);
      return true;
    } catch (err) {
      console.log('Database connection test error');
      setConnectionStatus('error');
      setLoadError('Connection error');
      return false;
    }
  }, []);

  const abortFetchRequests = useCallback(() => {
    if (abortController) {
      console.log('Aborting previous fetch requests');
      abortController.abort();
    }
    const newController = new AbortController();
    setAbortController(newController);
    return newController.signal;
  }, [abortController]);

  const fetchEntriesInternal = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      console.log('No userId provided to useJournalEntries');
      setLoading(false);
      return;
    }
    
    if (isRetrying && !forceRefresh) return;
    
    if (connectionStatus === 'error' && !forceRefresh) {
      console.log('Cannot fetch entries: connection error');
      setLoading(false);
      return;
    }
    
    const signal = abortFetchRequests();
    
    try {
      setLoading(true);
      setLoadError(null);
      
      if (connectionStatus !== 'connected' || forceRefresh) {
        const connectionTest = await checkDatabaseConnection();
        if (!connectionTest) {
          console.log('Database connection test failed before fetching entries');
          throw new Error('Database connection test failed');
        }
      }
      
      if (Date.now() - lastRetryTime < 1000 && !forceRefresh) {
        console.log('Throttling fetch requests');
        return;
      }
      
      setLastRetryTime(Date.now());
      
      console.log('Fetching journal entries...');
      const typedEntries = await fetchJournalEntries(userId);
      
      setRetryAttempt(0);
      
      setEntries(typedEntries);
      setLoading(false);

      const entriesNeedingThemes = typedEntries.filter(
        entry => (!entry.master_themes || entry.master_themes.length === 0) && entry["refined text"]
      );
      
      if (entriesNeedingThemes.length > 0) {
        console.log(`Found ${entriesNeedingThemes.length} entries without themes, processing...`);
        for (const entry of entriesNeedingThemes) {
          try {
            await generateThemesForEntry(entry);
          } catch (error) {
            console.log('Error generating themes for entry');
          }
        }
        
        if (entriesNeedingThemes.length > 0) {
          try {
            const refreshedData = await fetchJournalEntries(userId);
            setEntries(refreshedData);
          } catch (error) {
            console.log('Error in refresh after theme generation');
          }
        }
      }
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.log('Error fetching entries:', error);
        setLoadError('Failed to load journal entries. ' + (error.message || ''));
        
        if (!isRetrying && retryAttempt < MAX_RETRY_ATTEMPTS) {
          setRetryAttempt(prev => prev + 1);
          console.log(`Will retry fetch (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        }
      } else {
        console.log('Fetch request was aborted');
        setLoadError('Request timed out. Please try again.');
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [userId, retryAttempt, isRetrying, lastRetryTime, connectionStatus, abortFetchRequests, checkDatabaseConnection, MAX_RETRY_ATTEMPTS]);

  const saveJournalEntry = async (entryData: any) => {
    if (!userId) throw new Error('User ID is required to save journal entries');
    
    setIsSaving(true);
    try {
      const data = await saveToDB(entryData, userId);
      await fetchEntriesInternal();
      return data;
    } catch (error) {
      console.log('Error in saveJournalEntry');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteJournalEntry = async (id: number) => {
    try {
      await deleteFromDB(id);
      setEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (error) {
      console.log('Error in deleteJournalEntry');
      throw error;
    }
  };

  const refreshEntries = async (showToast = true) => {
    try {
      const now = Date.now();
      if (now - lastRetryTime < 2000) {
        console.log('Throttling refresh attempts');
        return;
      }
      
      setLastRetryTime(now);
      setIsRetrying(true);
      
      await fetchEntriesInternal(true);
      
      if (showToast) {
        toast.success('Journal entries refreshed', {
          dismissible: true,
        });
      }
    } catch (error) {
      console.log('Error in manual refresh');
      toast.error('Failed to refresh entries. Please try again.', {
        dismissible: true,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const processUnprocessedEntries = useCallback(async () => {
    if (!userId) {
      console.log('Cannot process entries: No user ID provided');
      return { success: false, processed: 0 };
    }
    
    if (isProcessing) {
      console.log('Already processing entries, please wait');
      return { success: false, processed: 0, alreadyProcessing: true };
    }
    
    setIsProcessing(true);
    
    try {
      const result = await processEntries(userId);
      setIsProcessing(false);
      return result;
    } catch (error) {
      console.log('Error in processUnprocessedEntries');
      toast.error('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
      return { success: false, processed: 0 };
    }
  }, [userId, isProcessing]);

  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    
    if (loadError && !loading && !isRetrying && retryAttempt < MAX_RETRY_ATTEMPTS && connectionStatus !== 'error') {
      console.log(`Auto-retrying fetch (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS}) in ${RETRY_DELAY / 1000} seconds...`);
      
      retryTimeout = setTimeout(() => {
        setIsRetrying(true);
        fetchEntriesInternal();
      }, RETRY_DELAY);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [loadError, loading, fetchEntriesInternal, retryAttempt, isRetrying, MAX_RETRY_ATTEMPTS, connectionStatus, RETRY_DELAY]);

  useEffect(() => {
    const forceCompleteTimeout = setTimeout(() => {
      if (loading) {
        console.log('Force completing loading state after timeout');
        setLoading(false);
        
        if (connectionStatus === 'checking') {
          setConnectionStatus('error');
          setLoadError('Connection to database timed out. Please check your internet connection and try again.');
        }
      }
    }, 15000);
    
    return () => {
      clearTimeout(forceCompleteTimeout);
    };
  }, [loading, connectionStatus]);

  useEffect(() => {
    if (userId && connectionStatus === 'connected') {
      setRetryAttempt(0);
      setLoadError(null);
      
      fetchEntriesInternal();
    } else if (connectionStatus === 'error') {
      console.log('Cannot fetch entries: connection error');
      setLoading(false);
    } else if (!userId) {
      console.log('No user ID available for fetching journal entries');
      setLoading(false);
      setEntries([]);
    }
  }, [userId, refreshKey, fetchEntriesInternal, connectionStatus]);

  return { 
    entries, 
    loading,
    saveJournalEntry,
    isSaving,
    deleteJournalEntry,
    refreshEntries,
    journalEntries: entries,
    isLoading: loading,
    loadError,
    retryCount: retryAttempt,
    processUnprocessedEntries,
    isProcessing,
    connectionStatus,
    testDatabaseConnection: checkDatabaseConnection
  };
}
