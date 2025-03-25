
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JournalHeader } from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import EmptyJournalState from '@/components/journal/EmptyJournalState';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useJournalHandler } from '@/hooks/use-journal-handler';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mic, BookOpen, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Journal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { 
    journalEntries, 
    isLoading, 
    refreshEntries, 
    loadError 
  } = useJournalEntries(user?.id);
  const { 
    handleCreateJournal, 
    handleViewInsights,
    processUnprocessedEntries,
    processAllEntries,
    isProcessingUnprocessedEntries
  } = useJournalHandler(user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [mode, setMode] = useState<'record' | 'past'>('past');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading || isProcessingUnprocessedEntries) {
        console.log('Force completing loading state due to timeout');
        setIsRefreshing(false);
        setProcessingEntries([]);
      }
    }, 10000);
    
    setLoadTimeout(timeout);
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [isLoading, isProcessingUnprocessedEntries]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tempId = queryParams.get('processing');
    
    if (tempId && !processingEntries.includes(tempId)) {
      setProcessingEntries(prev => [...prev, tempId]);
      
      // Clean URL without reloading page
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Set a timeout to remove the processing entry
      const processingTimeout = setTimeout(() => {
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        refreshEntries(false);
      }, 30000);
      
      // Schedule periodic refreshes while processing
      const refreshInterval = setInterval(() => {
        console.log("Auto-refreshing entries to check for processed entry");
        refreshEntries(false).then(() => {
          if (processingEntries.length === 0) {
            clearInterval(refreshInterval);
          }
        });
      }, 5000);
      
      return () => {
        clearTimeout(processingTimeout);
        clearInterval(refreshInterval);
      };
    }
  }, [location.search, processingEntries]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Pass true to show a toast notification for manual refresh
      await refreshEntries(true);
      // After refresh, clear any processing entries that might have been completed
      setProcessingEntries([]);
      setRefreshKey(prev => prev + 1); // Force a fresh fetch
    } catch (error) {
      console.error('Error refreshing entries:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleMode = (value: string) => {
    if (value === 'record') {
      navigate('/record');
    } else {
      setMode('past');
    }
  };

  const handleProcessAllEntries = async () => {
    const result = await processAllEntries();
    if (result?.success) {
      // Refresh entries after processing
      setTimeout(() => {
        refreshEntries(false);
      }, 2000);
    }
  };

  useEffect(() => {
    if (user?.id) {
      // Process unprocessed entries automatically on page load
      // Don't show a toast for this automatic process
      processUnprocessedEntries().then(result => {
        if (result?.success) {
          console.log('Successfully processed unprocessed entries');
          // Refresh entries without showing toast
          refreshEntries(false);
        }
      });
    }
  }, [user?.id, processUnprocessedEntries]);

  return (
    <div className="container px-4 md:px-6 max-w-6xl space-y-6 py-6">
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
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Entries</h2>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleProcessAllEntries}
            disabled={isProcessingUnprocessedEntries}
          >
            {isProcessingUnprocessedEntries ? (
              <>
                <Database className="h-4 w-4 mr-2 animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Process All Embeddings
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing || isProcessingUnprocessedEntries}
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>
      
      {loadError && !isLoading && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Failed to load journal entries. 
            <Button 
              variant="link" 
              className="p-0 h-auto text-destructive-foreground underline ml-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              Click to retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* We don't want the whole page to show a loading state if we have entries */}
      <JournalEntriesList 
        entries={journalEntries} 
        loading={isLoading}
        processingEntries={processingEntries}
        onStartRecording={() => navigate('/record')}
      />
    </div>
  );
}
