
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useJournalHandler(userId: string | undefined) {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCreateJournal = () => {
    // Navigate to the record page
    navigate('/record');
  };

  const handleViewInsights = () => {
    // Navigate to the insights page
    navigate('/insights');
  };

  const processUnprocessedEntries = useCallback(async () => {
    if (!userId) {
      console.log('Cannot process entries: No user ID provided');
      return { success: false, processed: 0 };
    }
    
    if (isProcessing) {
      console.log('Already processing entries, please wait');
      return { success: false, processed: 0, alreadyProcessing: true };
    }
    
    setIsProcessing(true);
    
    try {
      console.log('Processing unprocessed entries for user:', userId);
      
      // First check if the user can access their profile
      try {
        const { data: profileCheck, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
          
        if (profileError && !profileError.message.includes('Results contain 0 rows')) {
          console.error('Profile check error:', profileError);
          // With our new trigger function, we don't need to manually create profiles
          console.log('Relying on database trigger to handle profile');
        }
        
        if (!profileCheck) {
          console.log('Profile might not exist, but trigger should handle it');
        }
      } catch (profileCheckError) {
        console.error('Error checking profile:', profileCheckError);
      }
      
      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No active session found, cannot process entries');
        toast.error('Authentication required. Please sign in again.');
        setIsProcessing(false);
        return { success: false, processed: 0 };
      }
      
      try {
        // Use the correct URL format for the edge function
        const response = await fetch('https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/embed-all-entries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            userId,
            processAll: false // Only process entries without embeddings
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response from embed-all-entries:', errorText);
          toast.error('Failed to process journal entries. Please try again later.');
          setIsProcessing(false);
          return { success: false, processed: 0 };
        }
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`Successfully processed ${result.processedCount} entries`);
          setIsProcessing(false);
          return { success: true, processed: result.processedCount };
        } else {
          console.error('Error processing entries:', result.error);
          toast.error(result.error || 'Failed to process entries');
          setIsProcessing(false);
          return { success: false, processed: 0 };
        }
      } catch (fetchError) {
        console.error('Error calling embed-all-entries function:', fetchError);
        toast.error('Network error when processing entries. Please try again.');
        setIsProcessing(false);
        return { success: false, processed: 0 };
      }
    } catch (error) {
      console.error('Error in processUnprocessedEntries:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
      return { success: false, processed: 0 };
    }
  }, [userId, isProcessing]);

  return {
    handleCreateJournal,
    handleViewInsights,
    processUnprocessedEntries,
    isProcessing
  };
}
