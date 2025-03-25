
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JournalHeader from '@/components/journal/JournalHeader';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import EmptyJournalState from '@/components/journal/EmptyJournalState';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useJournalHandler } from '@/hooks/use-journal-handler';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mic, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Journal() {
  const navigate = useNavigate();
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
    isProcessingUnprocessedEntries
  } = useJournalHandler(user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [mode, setMode] = useState<'record' | 'past'>('past');
  const [refreshKey, setRefreshKey] = useState(0);

  // Extract processing entries from URL if present
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const tempId = queryParams.get('processing');
    
    if (tempId && !processingEntries.includes(tempId)) {
      setProcessingEntries(prev => [...prev, tempId]);
      
      // Clean URL without reloading page
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Set a timeout to remove the processing entry after some time
      // This is just in case it doesn't get refreshed by the normal refresh mechanism
      setTimeout(() => {
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
      }, 30000);
    }
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refreshEntries();
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

  // Run the processUnprocessedEntries function when the component mounts
  useEffect(() => {
    if (user?.id) {
      // Process unprocessed entries automatically on page load
      processUnprocessedEntries().then(result => {
        if (result?.success) {
          console.log('Successfully processed unprocessed entries');
          // Refresh entries to show the newly processed ones
          refreshEntries();
        }
      });
    }
  }, [user?.id, processUnprocessedEntries, refreshEntries]);

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
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing || isProcessingUnprocessedEntries || isLoading}
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
      
      {isLoading && journalEntries.length === 0 ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : journalEntries.length > 0 || processingEntries.length > 0 ? (
        <JournalEntriesList 
          entries={journalEntries} 
          loading={isLoading}
          processingEntries={processingEntries}
          onStartRecording={() => navigate('/record')}
        />
      ) : (
        <EmptyJournalState onStartRecording={() => navigate('/record')} />
      )}
    </div>
  );
}
