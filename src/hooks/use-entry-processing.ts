
// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Define simpler types to avoid complex type inference
interface SimpleJournalEntry {
  id: number;
  "foreign key"?: string;
  "refined text"?: string;
  created_at: string;
}

export function useEntryProcessing(
  activeTab: string,
  fetchEntries: () => void,
  entries: SimpleJournalEntry[]
) {
  const [processingEntries, setProcessingEntries] = useState<string[]>([]);
  const [processedEntryIds, setProcessedEntryIds] = useState<number[]>([]);
  
  // Poll for new entries when processing
  useEffect(() => {
    if (processingEntries.length > 0 && activeTab === 'entries') {
      console.log('Setting up polling for processing entries:', processingEntries);
      
      const pollingInterval = setInterval(() => {
        fetchEntries();
      }, 5000);
      
      return () => clearInterval(pollingInterval);
    }
  }, [processingEntries, activeTab, fetchEntries]);

  // Check if processing is complete
  useEffect(() => {
    if (processingEntries.length > 0 && entries.length > 0) {
      const newlyCompletedTempIds: string[] = [];
      
      for (const entry of entries) {
        // Use proper quotes for column names with spaces
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

  // Fix the type inference issue with separate variable declarations
  const checkEntryProcessed = useCallback(async (tempId: string): Promise<boolean> => {
    try {
      console.log('Checking if entry is processed with temp ID:', tempId);
      
      // Avoid deep type inference by separating the query and result handling
      const result = await supabase
        .from('Journal Entries')
        .select('id, "refined text"')
        .eq('"foreign key"', tempId)
        .single();
      
      // Extract data and error separately to avoid excessive type depth
      const data = result.data;
      const error = result.error;
      
      if (error) {
        console.error('Error fetching newly created entry:', error);
        return false;
      }
      
      if (!data) {
        return false;
      }
      
      console.log('New entry found:', data.id);
      
      // Ensure proper handling of column names with spaces
      if (data["refined text"]) {
        // Add @ts-ignore to bypass TypeScript's deep type instantiation error
        // @ts-ignore - Bypassing TypeScript's excessive type depth checking
        const invokeResult = await supabase.functions.invoke('generate-themes', {
          body: {
            text: data["refined text"],
            entryId: data.id
          }
        });

        // We don't need to use the result directly
        if (invokeResult.error) {
          console.error('Error generating themes:', invokeResult.error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking for processed entry:', error);
      return false;
    }
  }, []);

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
