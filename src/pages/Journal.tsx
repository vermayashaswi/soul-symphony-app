
import React, { useState } from 'react';
import { JournalHeader } from '@/components/journal/JournalHeader';
import { JournalEntriesList } from '@/components/journal/JournalEntriesList';
import { EmptyJournalState } from '@/components/journal/EmptyJournalState';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useJournalHandler } from '@/hooks/use-journal-handler';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { BackendTester } from '@/components/BackendTester';
import { toast } from 'sonner';

export default function Journal() {
  const { user } = useAuth();
  const { journalEntries, isLoading, refreshEntries } = useJournalEntries(user?.id);
  const { 
    handleCreateJournal, 
    handleViewInsights, 
    handleProcessAllEmbeddings, 
    isProcessingEmbeddings,
    processUnprocessedEntries,
    isProcessingUnprocessedEntries,
    testJournalRetrieval 
  } = useJournalHandler(user?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshEntries();
      toast.success('Journal entries refreshed');
    } catch (error) {
      console.error('Error refreshing entries:', error);
      toast.error('Failed to refresh entries');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Run the processUnprocessedEntries function when the component mounts
  React.useEffect(() => {
    if (user?.id) {
      // Process unprocessed entries automatically on page load
      processUnprocessedEntries().then(result => {
        if (result?.success) {
          console.log('Successfully processed unprocessed entries');
        }
      });
    }
  }, [user?.id]);

  return (
    <div className="container px-4 md:px-6 max-w-6xl space-y-6 py-6">
      <JournalHeader 
        onCreateJournal={handleCreateJournal} 
        onViewInsights={handleViewInsights} 
        onProcessAllEmbeddings={handleProcessAllEmbeddings}
        isProcessingEmbeddings={isProcessingEmbeddings}
        onProcessUnprocessedEntries={processUnprocessedEntries}
        isProcessingUnprocessedEntries={isProcessingUnprocessedEntries}
      />
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Entries</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
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
      
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : journalEntries.length > 0 ? (
        <JournalEntriesList entries={journalEntries} />
      ) : (
        <EmptyJournalState onCreate={handleCreateJournal} />
      )}
      
      <div className="mt-8">
        <BackendTester onTest={testJournalRetrieval} />
      </div>
    </div>
  );
}
