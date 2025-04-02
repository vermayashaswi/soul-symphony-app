
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

// Import the supabase client
import { supabase } from '@/integrations/supabase/client';

// Explicitly define the journal entry interface
interface SimpleJournalEntry {
  id: number;
  "foreign key"?: string;
  "refined text"?: string;
  content?: string;
  themes?: string[];
  created_at: string;
}

// Define explicit function types to avoid deep inference
type FetchEntriesFunction = () => void;

// Return type for the hook to break circular references
interface EntryProcessingHook {
  processingEntries: string[];
  processedEntryIds: number[];
  handleEntryRecording: (audioBlob: Blob, tempId?: string) => Promise<void>;
  setProcessingEntries: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useEntryProcessing(
  activeTab: string,
  fetchEntries: FetchEntriesFunction,
  entries: SimpleJournalEntry[]
): EntryProcessingHook {
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  
  // Poll for processing entries
  useEffect(() => {
    if (processingEntries.length > 0 && activeTab === 'entries') {
      console.log('Setting up polling for processing entries:', processingEntries);
      
      const pollingInterval = setInterval(() => {
        fetchEntries();
      }, 5000);
      
      return () => clearInterval(pollingInterval);
    }
  }, [processingEntries, activeTab, fetchEntries]);

  // Check for completed entries
  useEffect(() => {
    if (processingEntries.length > 0 && entries.length > 0) {
      const newlyCompletedTempIds: string[] = [];
      
      for (const entry of entries) {
        const foreignKey = entry["foreign key"];
        if (foreignKey && processingEntries.includes(foreignKey)) {
          newlyCompletedTempIds.push(foreignKey);
          setProcessedEntryIds(prev => [...prev, entry.id]);
        }
      }
      
      if (newlyCompletedTempIds.length > 0) {
        setProcessingEntries(prev => 
          prev.filter(id => !newlyCompletedTempIds.includes(id))
        );
      }
    }
  }, [entries, processingEntries]);

  // Use memoized callbacks to avoid recreating functions on each render
  const generateThemes = useCallback(async (text: string, entryId: number): Promise<void> => {
    try {
      await supabase.functions.invoke('generate-themes', {
        body: {
          text: text,
          entryId: entryId
        }
      });
    } catch (error) {
      console.error('Error generating themes:', error);
    }
  }, []);

  // Memoize this function to avoid recreating it on each render
  const checkEntryProcessed = useCallback(async (tempId: string): Promise<boolean> => {
    try {
      console.log('Checking if entry is processed with temp ID:', tempId);
      
      // Use type assertion for the response
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('id, "refined text"')
        .eq('"foreign key"', tempId);
      
      if (error) {
        console.error('Error fetching newly created entry:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        return false;
      }
      
      // Safely access data with explicit type assertions
      const entryId = data[0]?.id as number;
      const refinedText = data[0]?.["refined text"] as string | null;
      
      console.log('New entry found:', entryId);
      
      if (refinedText) {
        await generateThemes(refinedText, entryId);
      }
      
      return true;
    } catch (error) {
      console.error('Error checking for processed entry:', error);
      return false;
    }
  }, [generateThemes]);

  const handleEntryRecording = useCallback(async (audioBlob: Blob, tempId?: string): Promise<void> => {
    if (!tempId) {
      console.error('No tempId provided for entry recording');
      return;
    }
    
    console.log('Entry recorded, adding to processing queue:', tempId);
    
    setProcessingEntries(prev => [...prev, tempId]);
    fetchEntries();
    
    const pollInterval = setInterval(async () => {
      const isProcessed = await checkEntryProcessed(tempId);
      
      if (isProcessed) {
        clearInterval(pollInterval);
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        fetchEntries();
        toast.success('Journal entry processed successfully!');
      }
    }, 3000);
    
    // Set a timeout to prevent polling indefinitely
    setTimeout(() => {
      clearInterval(pollInterval);
      if (processingEntries.includes(tempId)) {
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        toast.info('Entry processing is taking longer than expected. It should appear soon.');
      }
    }, 120000);
  }, [checkEntryProcessed, fetchEntries, processingEntries]);

  return {
    processingEntries,
    processedEntryIds,
    handleEntryRecording,
    setProcessingEntries
  };
}
