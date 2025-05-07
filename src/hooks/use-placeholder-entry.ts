
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PlaceholderEntryService from '@/services/placeholderEntryService';

export function usePlaceholderEntry() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const ensurePlaceholderEntry = useCallback(async () => {
    if (!user?.id || isProcessing) return false;
    
    try {
      setIsProcessing(true);
      
      // Check if the user has any entries
      const hasEntries = await PlaceholderEntryService.userHasEntries(user.id);
      
      // If they don't have entries, create a placeholder
      if (!hasEntries) {
        const success = await PlaceholderEntryService.createPlaceholderIfNeeded(user.id);
        return success;
      }
      
      // User already has entries, no need for placeholder
      return false;
    } catch (error) {
      console.error('[usePlaceholderEntry] Error ensuring placeholder:', error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, isProcessing]);
  
  return {
    ensurePlaceholderEntry,
    isProcessing
  };
}
