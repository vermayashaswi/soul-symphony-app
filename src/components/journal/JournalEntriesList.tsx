
import React from 'react';
import { JournalEntry } from '@/types/journal';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmptyJournalState from '@/components/journal/EmptyJournalState';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  loadMore: () => void;
  hasMoreEntries: boolean;
  isLoadingMore: boolean;
  onDeleteEntry: (id: number) => void;
  processingEntries: string[];
  processedEntryIds: number[];
  onStartRecording: () => void;
  isProcessingFirstEntry?: boolean;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  loading,
  loadMore,
  hasMoreEntries,
  isLoadingMore,
  onDeleteEntry,
  processingEntries,
  processedEntryIds,
  onStartRecording,
  isProcessingFirstEntry = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!loading && entries.length === 0) {
    return (
      <EmptyJournalState 
        onStartRecording={onStartRecording}
        isProcessingFirstEntry={isProcessingFirstEntry}
      />
    );
  }

  return (
    <div>
      {entries.map((entry) => (
        <div key={entry.id} className="mb-4 p-4 bg-white rounded-md shadow-sm border">
          <div className="text-sm text-muted-foreground mb-1">
            {new Date(entry.created_at).toLocaleDateString()}
          </div>
          <p>{entry.content}</p>
          <div className="mt-2">
            {processingEntries.length > 0 && (
              <p className="text-sm text-orange-500">
                <TranslatableText text="Processing..." />
              </p>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onDeleteEntry(entry.id)}
              disabled={processingEntries.length > 0}
              className={cn(processingEntries.length > 0 && "cursor-not-allowed opacity-75")}
            >
              <TranslatableText text="Delete" />
            </Button>
          </div>
        </div>
      ))}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {hasMoreEntries && (
        <Button variant="outline" onClick={loadMore}>
          <TranslatableText text="Load More" />
        </Button>
      )}
    </div>
  );
};

export default JournalEntriesList;
