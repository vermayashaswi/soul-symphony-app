
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
  const [lastRefreshToastId, setLastRefreshToastId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchTimeout, setFetchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'checking' | 'error'>('checking');

  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY = 5000; // 5 seconds between retries
  const FETCH_TIMEOUT = 8000; // 8 seconds timeout for fetch operations
  const CONNECTION_TIMEOUT = 10000; // 10 seconds timeout for initial connection

  const checkDatabaseConnection = useCallback(async () => {
    console.log('Testing database connection...');
    try {
      const connectionTest = await testDatabaseConnection();
      
      if (!connectionTest.success) {
        console.error('Database health check failed:', connectionTest.error);
        setConnectionStatus('error');
        setLoadError('Connection to database failed: ' + connectionTest.error);
        return false;
      }
      
      console.log(`Database connection test successful (${connectionTest.duration}ms)`);
      setConnectionStatus('connected');
      setLoadError(null);
      return true;
    } catch (err: any) {
      console.error('Database connection test error:', err);
      setConnectionStatus('error');
      setLoadError('Connection error: ' + (err.message || 'Unknown error'));
      return false;
    }
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        setConnectionStatus('checking');
        console.log('Checking Supabase connection...');
        
        const connectionTimeoutId = setTimeout(() => {
          console.error('Database connection check timed out after', CONNECTION_TIMEOUT, 'ms');
          setConnectionStatus('error');
          setLoadError('Connection to database timed out. Please try again later.');
          setLoading(false);
        }, CONNECTION_TIMEOUT);
        
        const isConnected = await checkDatabaseConnection();
        
        clearTimeout(connectionTimeoutId);
        
        if (!isConnected) {
          console.error('Failed to connect to database');
          setLoading(false);
        } else {
          console.log('Successfully connected to database');
        }
      } catch (err) {
        console.error('Supabase connection check error:', err);
        setConnectionStatus('error');
        setLoadError('Connection to database failed');
        setLoading(false);
      }
    };
    
    checkConnection();
  }, [checkDatabaseConnection]);

  const fetchEntriesInternal = useCallback(async () => {
    if (!userId) {
      console.log('No userId provided to useJournalEntries');
      setLoading(false);
      return;
    }
    
    if (isRetrying) return;
    
    if (connectionStatus === 'error') {
      console.log('Cannot fetch entries: connection error');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setLoadError(null);
      
      console.log(`Attempting database access for user ${userId}`);
      
      if (connectionStatus !== 'connected') {
        const connectionTest = await checkDatabaseConnection();
        if (!connectionTest) {
          console.error('Database connection test failed before fetching entries');
          throw new Error('Database connection test failed');
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }
      
      const timeoutId = setTimeout(() => {
        console.error('Fetch entries operation timed out after', FETCH_TIMEOUT, 'ms');
        setLoading(false);
        setLoadError('Request timed out. Please try again later.');
        toast.error('Loading journal entries timed out', {
          id: 'journal-fetch-timeout',
          dismissible: true,
        });
      }, FETCH_TIMEOUT);
      
      setFetchTimeout(timeoutId);
      
      const typedEntries = await fetchJournalEntries(userId);
      
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
        setFetchTimeout(null);
      }
      
      toast.dismiss('journal-fetch-error');
      
      setRetryAttempt(0);
      
      setEntries(typedEntries);
      setLoading(false);

      if (typedEntries.length > 0) {
        const entriesNeedingThemes = typedEntries.filter(
          entry => (!entry.master_themes || entry.master_themes.length === 0) && entry["refined text"]
        );
        
        if (entriesNeedingThemes.length > 0) {
          console.log(`Found ${entriesNeedingThemes.length} entries without themes, processing...`);
          for (const entry of entriesNeedingThemes) {
            try {
              await generateThemesForEntry(entry);
            } catch (themeError) {
              console.error('Error generating themes for entry:', themeError);
            }
          }
          
          if (entriesNeedingThemes.length > 0) {
            try {
              const refreshedData = await fetchJournalEntries(userId);
              setEntries(refreshedData);
            } catch (refreshError) {
              console.error('Error in refresh after theme generation:', refreshError);
            }
          }
        }
      }
      
    } catch (error: any) {
      console.error('Error fetching entries:', error);
      setLoadError(error.message || 'Failed to load journal entries');
      
      if (!isRetrying && retryAttempt < MAX_RETRY_ATTEMPTS) {
        setRetryAttempt(prev => prev + 1);
      }
    } finally {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
        setFetchTimeout(null);
      }
      setLoading(false);
      setIsRetrying(false);
    }
  }, [userId, retryAttempt, isRetrying, fetchTimeout, MAX_RETRY_ATTEMPTS, FETCH_TIMEOUT, connectionStatus, checkDatabaseConnection]);

  const saveJournalEntry = async (entryData: any) => {
    if (!userId) throw new Error('User ID is required to save journal entries');
    
    setIsSaving(true);
    try {
      const data = await saveToDB(entryData, userId);
      await fetchEntriesInternal();
      return data;
    } catch (error) {
      console.error('Error in saveJournalEntry:', error);
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
      console.error('Error in deleteJournalEntry:', error);
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
      
      const forceCompleteTimeout = setTimeout(() => {
        console.log('Force completing refresh due to timeout');
        setIsRetrying(false);
        setLoading(false);
        toast.error('Refresh timed out. Please try again.', {
          id: 'journal-refresh-timeout',
          dismissible: true,
        });
      }, FETCH_TIMEOUT);
      
      await fetchEntriesInternal();
      
      clearTimeout(forceCompleteTimeout);
      
      if (showToast) {
        if (lastRefreshToastId) {
          toast.dismiss(lastRefreshToastId);
        }
        
        const toastId = `journal-refresh-${Date.now()}`;
        setLastRefreshToastId(toastId);
        
        toast.success('Journal entries refreshed', {
          id: toastId,
          dismissible: true,
        });
      }
    } catch (error) {
      console.error('Error in manual refresh:', error);
      toast.error('Failed to refresh entries. Please try again.', {
        id: 'journal-refresh-error',
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
      console.error('Error in processUnprocessedEntries:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
      return { success: false, processed: 0 };
    }
  }, [userId, isProcessing]);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    
    if (loadError && !loading && !isRetrying && retryAttempt < MAX_RETRY_ATTEMPTS && connectionStatus !== 'error') {
      console.log(`Auto-retrying fetch (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS}) in ${RETRY_DELAY / 1000} seconds...`);
      
      const backoffDelay = RETRY_DELAY * Math.pow(2, retryAttempt - 1);
      
      retryTimeout = setTimeout(() => {
        setIsRetrying(true);
        fetchEntriesInternal();
      }, backoffDelay);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (fetchTimeout) clearTimeout(fetchTimeout);
    };
  }, [loadError, loading, fetchEntriesInternal, retryAttempt, isRetrying, MAX_RETRY_ATTEMPTS, fetchTimeout, connectionStatus, RETRY_DELAY]);

  useEffect(() => {
    const forceCompleteTimeout = setTimeout(() => {
      if (loading) {
        console.log('Force completing loading state after timeout');
        setLoading(false);
        
        if (connectionStatus === 'checking') {
          setConnectionStatus('error');
          setLoadError('Connection to database timed out. Please try again.');
        }
      }
    }, 15000); // 15 seconds max loading time
    
    return () => {
      clearTimeout(forceCompleteTimeout);
    };
  }, [loading, connectionStatus]);

  useEffect(() => {
    if (userId && connectionStatus === 'connected') {
      setRetryAttempt(0);
      setLoadError(null);
      console.log(`Initial fetch triggered for user ${userId} with refreshKey ${refreshKey}`);
      
      const forceCompleteTimeout = setTimeout(() => {
        console.log('Force completing initial fetch due to timeout');
        setLoading(false);
      }, FETCH_TIMEOUT);
      
      fetchEntriesInternal().finally(() => {
        clearTimeout(forceCompleteTimeout);
      });
    } else if (connectionStatus === 'error') {
      console.log('Cannot fetch entries: connection error');
      setLoading(false);
    } else if (!userId) {
      console.log('No user ID available for fetching journal entries');
      setLoading(false);
      setEntries([]);
    }
    
    return () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }
    };
  }, [userId, refreshKey, fetchEntriesInternal, FETCH_TIMEOUT, connectionStatus]);

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
