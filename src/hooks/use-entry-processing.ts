
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Simple flat interfaces to avoid complex type inference
interface SimpleJournalEntry {
  id: number;
  "foreign key"?: string;
  "refined text"?: string;
  content?: string;
}

// Process entry response type
interface ProcessEntryResponse {
  id: number;
  "refined text"?: string;
}

// Simple response type for Supabase query
interface SimpleResponse {
  data: ProcessEntryResponse[] | null;
  error: { message: string } | null;
}

export function useEntryProcessing(
  activeTab: string,
  fetchEntries: () => void,
  entries: SimpleJournalEntry[]
) {
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

  // Check if an entry has been processed
  const checkEntryProcessed = async (tempId: string): Promise<boolean> => {
    try {
      console.log('Checking if entry is processed with temp ID:', tempId);
      
      // Use explicit Promise type and cast response to avoid deep type inference
      const response = await supabase
        .from('Journal Entries')
        .select('id, "refined text"')
        .eq('"foreign key"', tempId);
      
      // Manually handle response structure
      const data = response.data as ProcessEntryResponse[] | null;
      const error = response.error;
      
      if (error) {
        console.error('Error fetching newly created entry:', error);
        return false;
      }
      
      if (data && data.length > 0) {
        const entryId = data[0].id;
        const refinedText = data[0]["refined text"];
        
        console.log('New entry found:', entryId);
        
        if (refinedText) {
          // Handle theme generation separately to break up complex type chains
          await generateThemes(refinedText, entryId);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for processed entry:', error);
      return false;
    }
  };
  
  // Separate function to generate themes
  const generateThemes = async (text: string, entryId: number): Promise<void> => {
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
  };

  const handleEntryRecording = async (audioBlob: Blob, tempId?: string) => {
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
  };

  return {
    processingEntries,
    processedEntryIds,
    handleEntryRecording,
    setProcessingEntries
  };
}
