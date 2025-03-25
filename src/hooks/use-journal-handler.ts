
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useJournalHandler(userId: string | undefined) {
  const navigate = useNavigate();

  const handleCreateJournal = () => {
    // Navigate to the record page
    navigate('/record');
  };

  const handleViewInsights = () => {
    // Navigate to the insights page
    navigate('/insights');
  };

  const processUnprocessedEntries = async () => {
    if (!userId) {
      console.log('Cannot process entries: No user ID provided');
      return { success: false, processed: 0 };
    }
    
    try {
      console.log('Processing unprocessed entries for user:', userId);
      
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/embed-all-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          processAll: false // Only process entries without embeddings
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`Successfully processed ${result.processedCount} entries`);
        return { success: true, processed: result.processedCount };
      } else {
        console.error('Error processing entries:', result.error);
        return { success: false, processed: 0 };
      }
    } catch (error) {
      console.error('Error in processUnprocessedEntries:', error);
      return { success: false, processed: 0 };
    }
  };

  return {
    handleCreateJournal,
    handleViewInsights,
    processUnprocessedEntries
  };
}
