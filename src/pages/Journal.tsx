
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';
import JournalEntriesList from '@/components/journal/JournalEntriesList';
import JournalHeader from '@/components/journal/JournalHeader';
import JournalSearchAndFilters from '@/components/journal/JournalSearchAndFilters';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';

const Journal: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { currentLanguage } = useTranslation();
  const { user } = useAuth();
  
  const {
    entries,
    loading,
    fetchEntries,
    error
  } = useJournalEntries(user?.id, refreshKey, true);

  // Local state for immediate UI updates
  const [localEntries, setLocalEntries] = useState<JournalEntry[]>([]);
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  const [isSavingRecording, setIsSavingRecording] = useState(false);

  // Update local entries when entries change
  useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  // Handle refetch functionality
  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    fetchEntries();
  }, [fetchEntries]);

  // Handle entry updates for immediate UI feedback
  const handleUpdateEntry = useCallback((entryId: number, newContent: string, isProcessing?: boolean) => {
    console.log(`[Journal] Updating entry ${entryId} with new content: "${newContent.substring(0, 30)}..."`);
    
    setLocalEntries(prevEntries => {
      return prevEntries.map(entry => {
        if (entry.id === entryId) {
          return {
            ...entry,
            content: newContent,
            "refined text": newContent,
            "transcription text": newContent,
            Edit_Status: 1,
            // Reset analysis fields since content changed
            sentiment: null,
            master_themes: [],
            themes: [],
            entities: []
          };
        }
        return entry;
      });
    });
  }, []);

  const handleDeleteEntry = async (entryId: number) => {
    try {
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        console.error('Error deleting entry:', error);
        throw error;
      }

      // Update local state immediately
      setLocalEntries(prevEntries => prevEntries.filter(entry => entry.id !== entryId));
      
      // Refetch to ensure consistency
      refetch();
    } catch (error) {
      console.error('Failed to delete entry:', error);
      throw error;
    }
  };

  const handleStartRecording = () => {
    console.log('[Journal] Starting voice recording');
    setIsSavingRecording(true);
    // Add any additional recording logic here
  };

  // Filter entries based on search query and date range
  const filteredEntries = useMemo(() => {
    let filtered = localEntries;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => {
        const content = entry.content || entry["refined text"] || entry["transcription text"] || "";
        return content.toLowerCase().includes(query);
      });
    }

    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.created_at);
        const from = dateRange?.from;
        const to = dateRange?.to;
        
        if (from && to) {
          return entryDate >= from && entryDate <= to;
        } else if (from) {
          return entryDate >= from;
        } else if (to) {
          return entryDate <= to;
        }
        
        return true;
      });
    }

    return filtered;
  }, [localEntries, searchQuery, dateRange]);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <JournalHeader />
          <div className="mt-8 text-center">
            <p className="text-red-500">Error loading journal entries: {error}</p>
            <button 
              onClick={() => refetch()} 
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        <JournalHeader />
        
        <JournalSearchAndFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        
        <div className="mt-6">
          <JournalEntriesList
            entries={filteredEntries}
            loading={loading}
            processingEntries={processingEntries}
            processedEntryIds={processedEntryIds}
            onStartRecording={handleStartRecording}
            onDeleteEntry={handleDeleteEntry}
            onUpdateEntry={handleUpdateEntry}
            isSavingRecording={isSavingRecording}
          />
        </div>
      </div>
    </div>
  );
};

export default Journal;
