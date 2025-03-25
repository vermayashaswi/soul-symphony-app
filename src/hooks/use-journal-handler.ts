
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function useJournalHandler(userId: string | undefined) {
  const navigate = useNavigate();
  const [isProcessingUnprocessedEntries, setIsProcessingUnprocessedEntries] = useState(false);

  const handleCreateJournal = () => {
    // Navigate to the record page
    navigate('/record');
  };

  const handleViewInsights = () => {
    // Navigate to the insights page
    navigate('/insights');
  };

  // Function to handle specifically unprocessed entries (NULL embeddings)
  const processUnprocessedEntries = async () => {
    if (!userId) {
      console.log("No user ID available for processing entries");
      return { success: false, message: "Authentication required" };
    }

    if (isProcessingUnprocessedEntries) {
      console.log("Already processing entries, skipping");
      return { success: false, message: "Already processing" };
    }

    setIsProcessingUnprocessedEntries(true);
    try {
      console.log('Processing unprocessed journal entries...');
      
      // Call the Supabase Edge Function to process only unprocessed entries
      const { data, error } = await supabase.functions.invoke('embed-all-entries', {
        body: { 
          userId,
          processAll: false  // Flag to only process entries without embeddings
        }
      });
      
      if (error) {
        console.error('Error processing unprocessed entries:', error);
        toast.error('Failed to process journal embeddings');
        return { success: false, error: error.message };
      }
      
      if (data?.success) {
        console.log('Unprocessed entries processed successfully:', data);
        if (data.processedCount > 0) {
          toast.success(`Successfully processed ${data.processedCount} journal entries`);
        }
        return data;
      } else {
        console.error('Failed to process unprocessed journal entries:', data);
        toast.error('Failed to process journal embeddings');
        return { success: false, message: data?.error || "Unknown error" };
      }
    } catch (error: any) {
      console.error('Error in processUnprocessedEntries:', error);
      toast.error('Error processing journal embeddings');
      return { success: false, error: error.message || "Unknown error" };
    } finally {
      setIsProcessingUnprocessedEntries(false);
    }
  };

  // Same as above but for all entries (including those with embeddings)
  const processAllEntries = async () => {
    if (!userId) {
      console.log("No user ID available for processing entries");
      return { success: false, message: "Authentication required" };
    }

    if (isProcessingUnprocessedEntries) {
      console.log("Already processing entries, skipping");
      return { success: false, message: "Already processing" };
    }

    setIsProcessingUnprocessedEntries(true);
    toast.loading('Processing all journal entries...', {
      id: 'process-all-entries',
      duration: 10000,
    });
    
    try {
      console.log('Processing ALL journal entries...');
      
      // Call the Supabase Edge Function to process all entries
      const { data, error } = await supabase.functions.invoke('embed-all-entries', {
        body: { 
          userId,
          processAll: true  // Flag to process all entries
        }
      });
      
      toast.dismiss('process-all-entries');
      
      if (error) {
        console.error('Error processing all entries:', error);
        toast.error('Failed to process journal embeddings');
        return { success: false, error: error.message };
      }
      
      if (data?.success) {
        console.log('All entries processed successfully:', data);
        toast.success(`Successfully processed ${data.processedCount} journal entries`);
        return data;
      } else {
        console.error('Failed to process all journal entries:', data);
        toast.error('Failed to process journal embeddings');
        return { success: false, message: data?.error || "Unknown error" };
      }
    } catch (error: any) {
      toast.dismiss('process-all-entries');
      console.error('Error in processAllEntries:', error);
      toast.error('Error processing journal embeddings');
      return { success: false, error: error.message || "Unknown error" };
    } finally {
      setIsProcessingUnprocessedEntries(false);
    }
  };

  return {
    handleCreateJournal,
    handleViewInsights,
    processUnprocessedEntries,
    processAllEntries,
    isProcessingUnprocessedEntries
  };
}
