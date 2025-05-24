
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntriesSimplified } from '@/hooks/use-journal-entries-simplified';
import { JournalEntry } from '@/types/journal';
import EmptyJournalState from '@/components/journal/EmptyJournalState';
import JournalEntryCard from '@/components/journal/JournalEntryCard';
import { Skeleton } from '@/components/ui/skeleton';

interface JournalContentImprovedProps {
  refreshKey: number;
}

const JournalContentImproved: React.FC<JournalContentImprovedProps> = ({ refreshKey }) => {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { 
    entries, 
    loading, 
    error, 
    profileExists,
    fetchEntries 
  } = useJournalEntriesSimplified(user?.id, refreshKey);

  // Mark as initialized after first load attempt
  useEffect(() => {
    if (!loading && !isInitialized) {
      setIsInitialized(true);
    }
  }, [loading, isInitialized]);

  // Show loading skeleton on initial load
  if (!isInitialized && loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500 mb-4">Error loading entries: {error}</p>
        <button 
          onClick={() => fetchEntries()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show empty state for new users
  if (isInitialized && entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyJournalState />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {entries.map((entry: JournalEntry) => (
        <JournalEntryCard 
          key={entry.id} 
          entry={entry}
          showTranslateButton={true}
          allowEditing={true}
        />
      ))}
      
      {loading && entries.length > 0 && (
        <div className="text-center p-4">
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default JournalContentImproved;
