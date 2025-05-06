
import React from 'react';
import JournalEntryCard from './JournalEntryCard';
import { JournalEntry } from '@/types/journal';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import EmptyJournalState from './EmptyJournalState';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  loadMore: () => void;
  hasMoreEntries: boolean;
  isLoadingMore: boolean;
  onEntryDeleted?: (id: number) => void;
  onDeleteEntry?: (id: number) => Promise<void>;
  processingEntries?: any[];
  processedEntryIds?: number[];
  onStartRecording?: () => void;
  isProcessingFirstEntry?: boolean;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  loading,
  loadMore,
  hasMoreEntries,
  isLoadingMore,
  onEntryDeleted,
  onDeleteEntry,
  onStartRecording = () => {},
  processingEntries = [],
  processedEntryIds = [],
  isProcessingFirstEntry = false
}) => {
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <JournalEntryLoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!loading && entries.length === 0) {
    return <EmptyJournalState 
      onStartRecording={onStartRecording}
      isProcessingFirstEntry={isProcessingFirstEntry} 
    />;
  }

  const handleDeleteEntry = async (id: number) => {
    if (onEntryDeleted) {
      onEntryDeleted(id);
      return;
    }
    
    if (onDeleteEntry) {
      await onDeleteEntry(id);
    }
  };

  return (
    <div className="space-y-4" id="journal-entries-list" data-tutorial="journal-entries-list">
      {entries.map((entry) => (
        <JournalEntryCard 
          key={entry.id} 
          entry={entry} 
          onDelete={() => handleDeleteEntry(entry.id)}
          showDate={true}
        />
      ))}
      
      {(isLoadingMore || hasMoreEntries) && (
        <div className="py-4 flex justify-center">
          {isLoadingMore ? (
            <div className="animate-pulse flex items-center">
              <div className="h-4 w-4 bg-primary rounded-full mr-2"></div>
              <span className="text-sm text-muted-foreground">
                <TranslatableText text="Loading..." />
              </span>
            </div>
          ) : (
            <Button 
              onClick={loadMore} 
              variant="outline"
              disabled={!hasMoreEntries}
            >
              <TranslatableText text="Load More" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default JournalEntriesList;
