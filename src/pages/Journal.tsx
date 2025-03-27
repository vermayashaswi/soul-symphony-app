import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JournalHeader } from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useJournalHandler } from '@/hooks/use-journal-handler';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mic, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import JournalDiagnostics from '@/components/diagnostics/JournalDiagnostics';
import { useDebug } from '@/contexts/debug/DebugContext';
import { ensureAudioBucketExists } from '@/utils/audio-processing';

export default function Journal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addLog } = useDebug();
  
  const { 
    entries: journalEntries, 
    loading: isLoading, 
    refreshEntries, 
    loadError,
    connectionStatus,
    testDatabaseConnection
  } = useJournalEntries(user?.id);
  const { 
    handleCreateJournal, 
    handleViewInsights,
    processUnprocessedEntries,
    isProcessing
  } = useJournalHandler(user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [directEntryId, setDirectEntryId] = useState<number | null>(null);
  const [mode, setMode] = useState<'record' | 'past'>('past');
  const [refreshCount, setRefreshCount] = useState(0);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isFixingStorage, setIsFixingStorage] = useState(false);

  useEffect(() => {
    addLog('navigation', 'Journal page mounted', { userId: user?.id });
    
    return () => {
      addLog('navigation', 'Journal page unmounted');
    };
  }, [addLog, user?.id]);

  useEffect(() => {
    addLog('network', `Journal page connection status: ${connectionStatus}`);
  }, [connectionStatus, addLog]);

  useEffect(() => {
    addLog('info', `Journal entries loading state: ${isLoading}`);
  }, [isLoading, addLog]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('Checking Supabase connection...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .abortSignal(controller.signal);
        
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('Supabase connection check failed:', error);
          toast.error('Database connection failed', {
            id: 'db-connection-error',
            dismissible: true,
          });
        } else {
          console.log('Supabase connection confirmed');
        }
      } catch (err) {
        console.error('Supabase connection check error:', err);
      }
    };
    
    checkConnection();
  }, []);

  useEffect(() => {
    const checkAudioBucket = async () => {
      if (user?.id && !isFixingStorage) {
        setIsFixingStorage(true);
        
        try {
          const bucketExists = await ensureAudioBucketExists();
          
          if (!bucketExists) {
            console.warn('Audio bucket not properly configured');
            toast.error('Audio storage is not properly configured', {
              id: 'audio-storage-issue',
              duration: 5000,
            });
          }
        } catch (err) {
          console.error('Error in storage check:', err);
        } finally {
          setIsFixingStorage(false);
        }
      }
    };
    
    if (user?.id && !isFixingStorage) {
      checkAudioBucket();
    }
  }, [user?.id, isFixingStorage]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tempId = queryParams.get('processing');
    const entryId = queryParams.get('entry');
    
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    
    if (tempId && !processingEntries.includes(tempId)) {
      console.log('Adding processing entry from URL:', tempId);
      setProcessingEntries(prev => [...prev, tempId]);
      
      const processingTimeout = setTimeout(() => {
        console.log('Processing entry timeout reached, refreshing');
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        refreshEntries(false);
      }, 30000);
      
      const refreshInterval = setInterval(() => {
        console.log("Auto-refreshing to check for processed entry");
        refreshEntries(false);
      }, 5000);
      
      return () => {
        clearTimeout(processingTimeout);
        clearInterval(refreshInterval);
      };
    }
    
    if (entryId) {
      const entryIdNumber = parseInt(entryId, 10);
      if (!isNaN(entryIdNumber)) {
        console.log('Setting direct entry view for ID:', entryIdNumber);
        setDirectEntryId(entryIdNumber);
        if (!isRefreshing && !isLoading) {
          refreshEntries(false);
        }
      }
    }
  }, [location.search, processingEntries, refreshEntries, isRefreshing, isLoading]);

  useEffect(() => {
    if (user) {
      const checkProfile = async () => {
        try {
          console.log('Checking for profile:', user.id);
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

          if (error) {
            console.log('Profile not found, creating one');
            
            const { error: createError } = await supabase
              .from('profiles')
              .insert([{ id: user.id }]);
            
            if (createError) {
              console.error('Failed to create profile:', createError);
            } else {
              console.log('Profile created successfully');
              setTimeout(() => refreshEntries(false), 1000);
            }
          } else {
            console.log('Profile exists:', data.id);
          }
        } catch (err) {
          console.error('Error in profile check/creation:', err);
        }
      };
      
      checkProfile();
    }
  }, [user, refreshEntries]);

  useEffect(() => {
    if (processingEntries.length > 0 && !isRefreshing && !isLoading) {
      console.log('Setting up refresh interval for processing entries');
      const interval = setInterval(() => {
        console.log('Auto refreshing for processing entries');
        refreshEntries(false);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [processingEntries, isRefreshing, isLoading, refreshEntries]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Force completing loading state due to timeout');
        setIsRefreshing(false);
        
        if (processingEntries.length > 0) {
          console.log('Clearing stuck processing entries');
          setProcessingEntries([]);
        }
        
        setRefreshCount(prev => prev + 1);
      }
    }, 15000);
    
    setLoadTimeout(timeout);
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [isLoading, processingEntries.length]);

  useEffect(() => {
    if (!isLoading && journalEntries && journalEntries.length > 0 && processingEntries.length > 0) {
      console.log('Checking if processing entries are now available in journal entries');
      setProcessingEntries([]);
    }
  }, [isLoading, journalEntries, processingEntries.length]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    addLog('action', 'Manual refresh requested on Journal page');
    setIsRefreshing(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const { error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .abortSignal(controller.signal);
        
        if (error) {
          console.error('Database connection test failed:', error);
          toast.error('Database connection failed');
          setIsRefreshing(false);
          return;
        }
      } catch (e) {
        console.error('Connection test error:', e);
        toast.error('Database connection test failed');
        setIsRefreshing(false);
        return;
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (user?.id) {
        addLog('action', 'Processing unprocessed entries');
        const processingResult = await processUnprocessedEntries();
        
        if (processingResult.alreadyProcessing) {
          addLog('info', 'Entries already being processed');
          setIsRefreshing(false);
          return;
        }
      }
      
      addLog('action', 'Refreshing journal entries');
      await refreshEntries(true);
      setProcessingEntries([]);
      addLog('info', 'Journal entries refreshed successfully');
      
    } catch (error) {
      console.error('Error refreshing entries:', error);
      addLog('error', 'Error refreshing entries', { error });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleMode = (value: string) => {
    if (value === 'record' && !isRefreshing) {
      navigate('/record');
    } else {
      setMode('past');
    }
  };

  const handleTestConnection = async () => {
    if (!testDatabaseConnection) return;
    
    toast.loading('Testing database connection...', {
      id: 'test-connection',
    });
    
    try {
      const result = await testDatabaseConnection();
      
      if (result) {
        toast.success('Successfully connected to database', {
          id: 'test-connection',
        });
        
        const bucketExists = await ensureAudioBucketExists();
        
        if (bucketExists) {
          toast.success('Audio storage is configured properly', {
            id: 'test-connection',
            duration: 3000,
          });
        } else {
          toast.error('Audio storage is not configured properly', {
            id: 'test-connection',
            duration: 5000,
          });
        }
        
        setTimeout(() => refreshEntries(false), 500);
      } else {
        toast.error('Failed to connect to database', {
          id: 'test-connection',
        });
      }
    } catch (err) {
      toast.error('Connection test failed', {
        id: 'test-connection',
      });
    }
  };

  if (connectionStatus === 'error') {
    return (
      <div className="container px-4 md:px-6 max-w-6xl space-y-6 py-6">
        <JournalDiagnostics />
        
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <AlertTitle>Database Connection Error</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            <span>{loadError}</span>
            <Button 
              variant="outline" 
              className="ml-2"
              onClick={handleTestConnection}
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Test Connection
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container px-4 md:px-6 max-w-6xl space-y-6 py-6">
      <JournalDiagnostics />
      
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">Journal</CardTitle>
          <div className="mt-2 flex justify-between items-center">
            <ToggleGroup type="single" value={mode} onValueChange={(value) => handleToggleMode(value)} className="justify-start">
              <ToggleGroupItem value="record" className="gap-1">
                <Mic className="h-4 w-4" />
                <span>Record Entry</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="past" className="gap-1">
                <BookOpen className="h-4 w-4" />
                <span>Past Entries</span>
              </ToggleGroupItem>
            </ToggleGroup>
            
            <div className="flex gap-2">
              <Button
                onClick={handleViewInsights}
                variant="outline"
                size="sm"
              >
                View Insights
              </Button>
              
              <Button onClick={() => navigate('/record')}>
                New Journal Entry
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <JournalHeader
        onCreateJournal={handleCreateJournal}
        onViewInsights={handleViewInsights}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      
      {loadError && !isLoading && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <AlertTitle>Error Loading Entries</AlertTitle>
          <AlertDescription className="flex justify-between items-center">
            <span>{loadError}</span>
            <Button 
              variant="outline" 
              className="ml-2"
              onClick={handleTestConnection}
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Test Connection
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {connectionStatus === 'checking' && (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Connecting to database...</p>
        </div>
      )}
      
      {isLoading && (
        <div className="text-center py-6">
          <JournalEntriesList 
            entries={[]} 
            loading={true}
            processingEntries={processingEntries}
            onStartRecording={() => navigate('/record')}
            onRefresh={handleTestConnection}
            connectionStatus={connectionStatus}
            loadError={loadError}
          />
        </div>
      )}
      
      {!isLoading && (
        <JournalEntriesList 
          entries={journalEntries || []} 
          loading={false}
          processingEntries={processingEntries}
          onStartRecording={() => navigate('/record')}
          onRefresh={handleTestConnection}
          connectionStatus={connectionStatus}
          loadError={loadError}
        />
      )}
    </div>
  );
}
