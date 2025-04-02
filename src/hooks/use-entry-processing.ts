
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Simple type for journal entry to avoid complex type inference
interface JournalEntryResponse {
  id: number;
  "refined text"?: string;
  [key: string]: any;
}

export function useEntryProcessing(
  activeTab: string,
  fetchEntries: () => void,
  entries: any[]
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
      const newlyCompletedTempIds = [];
      
      for (const entry of entries) {
        if (entry.foreignKey && processingEntries.includes(entry.foreignKey)) {
          newlyCompletedTempIds.push(entry.foreignKey);
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

  const handleEntryRecording = async (audioBlob: Blob, tempId?: string) => {
    console.log('Entry recorded, adding to processing queue');
    
    if (tempId) {
      setProcessingEntries(prev => [...prev, tempId]);
    }
    
    fetchEntries();
    
    const checkEntryProcessed = async () => {
      try {
        console.log('Checking if entry is processed with temp ID:', tempId);
        
        // Use a simple query with explicit type casting to avoid deep type instantiation
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('id, "refined text"')
          .eq('"foreign key"', tempId);
          
        if (error) {
          console.error('Error fetching newly created entry:', error);
          return false;
        }
        
        if (data && data.length > 0) {
          // Cast data[0] to our simple interface
          const entry = data[0] as JournalEntryResponse;
          const entryId = entry.id;
          const refinedText = entry["refined text"];
          
          console.log('New entry found:', entryId);
          
          if (refinedText) {
            await supabase.functions.invoke('generate-themes', {
              body: {
                text: refinedText,
                entryId: entryId
              }
            });
          }
          
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking for processed entry:', error);
        return false;
      }
    };
    
    const pollInterval = setInterval(async () => {
      const isProcessed = await checkEntryProcessed();
      
      if (isProcessed) {
        clearInterval(pollInterval);
        setProcessingEntries(prev => prev.filter(id => id !== tempId));
        fetchEntries();
        toast.success('Journal entry processed successfully!');
      }
    }, 3000);
    
    setTimeout(() => {
      clearInterval(pollInterval);
      if (processingEntries.includes(tempId || '')) {
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
