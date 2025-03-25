
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useJournalEntries } from './use-journal-entries';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function useJournalHandler(userId: string | undefined) {
  const navigate = useNavigate();
  const [isTestingBackend, setIsTestingBackend] = useState(false);
  const [isProcessingUnprocessedEntries, setIsProcessingUnprocessedEntries] = useState(false);

  const handleCreateJournal = () => {
    // Navigate to the record tab or show the journal creation dialog
    console.log('Create journal entry');
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
        return { success: false, error };
      }
      
      if (data?.success) {
        console.log('Unprocessed entries processed successfully:', data);
        return data;
      } else {
        console.error('Failed to process unprocessed journal entries:', data);
        return { success: false };
      }
    } catch (error) {
      console.error('Error in processUnprocessedEntries:', error);
      return { success: false, error };
    } finally {
      setIsProcessingUnprocessedEntries(false);
    }
  };

  const testJournalRetrieval = async () => {
    if (!userId) {
      toast.error("Authentication required. Please sign in to test journal retrieval");
      return { success: false, message: "Authentication required" };
    }

    setIsTestingBackend(true);
    try {
      console.log('Testing journal retrieval for user ID:', userId);
      
      // Query test 1: Direct database query
      const { data: entriesData, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .limit(5);
        
      if (entriesError) {
        console.error('Test failed - Error fetching journal entries:', entriesError);
        toast.error(`Backend test failed: ${entriesError.message}`);
        return { success: false, message: entriesError.message };
      }
      
      // Query test 2: Test embedding search if applicable
      const testQuery = "test query for embeddings";
      let embeddingResults = null;
      
      try {
        const { data: searchData, error: searchError } = await supabase.functions.invoke('search-journal', {
          body: { 
            query: testQuery,
            userId: userId,
            threadId: 'test-thread',
            matchCount: 3
          }
        });
        
        if (searchError) {
          console.error('Embedding search test failed:', searchError);
        } else {
          embeddingResults = searchData;
          console.log('Embedding search test results:', searchData);
        }
      } catch (searchTestError) {
        console.error('Exception during embedding search test:', searchTestError);
      }
      
      const resultMessage = `Found ${entriesData?.length || 0} journal entries. ${
        embeddingResults ? `Embedding search returned ${embeddingResults.results?.length || 0} results.` : 'Embedding search was not tested.'
      }`;
      
      console.log('Backend test results:', resultMessage);
      
      toast.success(`Backend test completed: ${resultMessage}`);
      
      return { 
        success: true, 
        entriesCount: entriesData?.length || 0,
        entries: entriesData,
        embeddingResults: embeddingResults
      };
    } catch (error) {
      console.error('Unexpected error during backend test:', error);
      toast.error(`Backend test failed: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, message: String(error) };
    } finally {
      setIsTestingBackend(false);
    }
  };

  return {
    handleCreateJournal,
    handleViewInsights,
    processUnprocessedEntries,
    isProcessingUnprocessedEntries,
    testJournalRetrieval,
    isTestingBackend
  };
}
