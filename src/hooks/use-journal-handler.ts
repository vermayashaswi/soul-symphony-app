
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
      console.log('Processing entries for user:', userId);
      
      // Simplified profile check
      try {
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
          
        if (!profileCheck) {
          console.log('Profile not found, creating one');
          
          await supabase
            .from('profiles')
            .insert({ id: userId });
            
          console.log('Profile created');
        }
      } catch (error) {
        console.log('Error checking profile');
        // Continue anyway
      }
      
      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No active session found');
        toast.error('Authentication required. Please sign in again.');
        setIsProcessing(false);
        return { success: false, processed: 0 };
      }
      
      try {
        // Add a timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/embed-all-entries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            userId,
            processAll: false // Only process entries without embeddings
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.log('Error response from embed-all-entries');
          toast.error('Failed to process journal entries');
          setIsProcessing(false);
          return { success: false, processed: 0 };
        }
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`Processed ${result.processedCount} entries`);
          setIsProcessing(false);
          return { success: true, processed: result.processedCount };
        } else {
          console.log('Error processing entries');
          toast.error('Failed to process entries');
          setIsProcessing(false);
          return { success: false, processed: 0 };
        }
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          console.log('Request timed out');
          toast.error('Request timed out. Please try again.');
        } else {
          console.log('Error calling function');
          toast.error('Error processing entries');
        }
        setIsProcessing(false);
        return { success: false, processed: 0 };
      }
    } catch (error) {
      console.log('Error in processUnprocessedEntries');
      toast.error('An error occurred');
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
