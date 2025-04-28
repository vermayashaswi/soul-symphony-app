import React, { useState, useEffect } from 'react';
import JournalEntryCard from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import JournalSearch from './JournalSearch';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import DateRangeFilter from './DateRangeFilter';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

// This component would be imported elsewhere, so we need to keep the existing structure
export interface JournalEntriesList {
  entries: any[];
  loading: boolean;
  processingEntries?: string[];
  processedEntryIds?: number[];
  onStartRecording: () => void;
  onDeleteEntry: (entryId: number) => Promise<void>;
}

const JournalEntriesList: React.FC<JournalEntriesList> = ({ 
  entries, 
  loading, 
  processingEntries = [],
  processedEntryIds = [],
  onStartRecording,
  onDeleteEntry
}) => {
  const [filteredEntries, setFilteredEntries] = useState(entries);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const { currentLanguage } = useTranslation();
  const [key, setKey] = useState(Date.now());
  const [isFilterActive, setIsFilterActive] = useState(false);
  
  // Force re-render when language changes
  useEffect(() => {
    setKey(Date.now());
    console.log(`JournalEntriesList: Language changed to ${currentLanguage}, forcing re-render`);
  }, [currentLanguage]);
  
  useEffect(() => {
    setFilteredEntries(entries);
  }, [entries]);
  
  const handleSearchResults = (results: any[]) => {
    setFilteredEntries(results);
  };
  
  const handleSelectEntry = (entry: any) => {
    setSelectedEntry(entry);
  };
  
  const handleFilterActive = (active: boolean) => {
    setIsFilterActive(active);
  };
  
  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            <TranslatableText text="Your journal entries" />
          </h2>
          <Button onClick={onStartRecording} size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            <TranslatableText text="New entry" />
          </Button>
        </div>
        
        <JournalEntryLoadingSkeleton count={3} />
      </div>
    );
  }
  
  if (entries.length === 0) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }
  
  return (
    <div key={`journal-entries-list-${key}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">
          <TranslatableText text="Your journal entries" />
        </h2>
        <Button onClick={onStartRecording} size="sm" className="gap-2">
          <PlusCircle className="h-4 w-4" />
          <TranslatableText text="New entry" />
        </Button>
      </div>
      
      <JournalSearch 
        entries={entries}
        onSelectEntry={handleSelectEntry}
        onSearchResults={handleSearchResults}
      />
      
      <DateRangeFilter 
        entries={entries} 
        onFilterChange={handleSearchResults}
        onFilterActive={handleFilterActive}
      />
      
      <div className="mt-6 space-y-6">
        {filteredEntries.map(entry => (
          <JournalEntryCard
            key={entry.id}
            entry={entry}
            isProcessing={processingEntries.some(id => id === entry.processing_id)}
            onDelete={() => onDeleteEntry(entry.id)}
          />
        ))}
        
        {filteredEntries.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              <TranslatableText text="No entries match your search criteria." />
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalEntriesList;
