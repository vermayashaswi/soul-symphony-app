
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PlaceholderEntryService from '@/services/placeholderEntryService';

export function usePlaceholderEntry() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = useRef(3);
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }
    };
  }, []);
  
  const ensurePlaceholderEntry = useCallback(async (): Promise<boolean> => {
    if (!user?.id || isProcessing) return false;
    
    try {
      setIsProcessing(true);
      
      console.log('[usePlaceholderEntry] Ensuring placeholder entry exists');
      
      // Use the enhanced verification method
      const success = await PlaceholderEntryService.ensurePlaceholderWithVerification(user.id);
      
      if (success) {
        console.log('[usePlaceholderEntry] Placeholder entry verified successfully');
        setIsVerified(true);
        setRetryCount(0); // Reset retry count on success
        return true;
      } else if (retryCount < maxRetries.current) {
        // Implement retry logic
        console.log(`[usePlaceholderEntry] Verification failed, retrying (${retryCount + 1}/${maxRetries.current})`);
        setRetryCount(prev => prev + 1);
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsProcessing(false);
        
        // Return the result of the retry
        return await ensurePlaceholderEntry();
      }
      
      console.error('[usePlaceholderEntry] Max retries reached for placeholder verification');
      return false;
    } catch (error) {
      console.error('[usePlaceholderEntry] Error ensuring placeholder:', error);
      return false;
    } finally {
      // Set a small delay before resetting processing state to prevent rapid retriggering
      operationTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  }, [user?.id, isProcessing, retryCount]);
  
  // Method to verify if user has entries with retries
  const verifyUserHasEntries = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      return await PlaceholderEntryService.userHasEntries(user.id);
    } catch (error) {
      console.error('[usePlaceholderEntry] Error verifying entries:', error);
      return false;
    }
  }, [user?.id]);
  
  return {
    ensurePlaceholderEntry,
    verifyUserHasEntries,
    isProcessing,
    isVerified
  };
}
