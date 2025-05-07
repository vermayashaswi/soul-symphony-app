
import React, { useEffect, useState, useCallback } from 'react';
import { createPlaceholderEntry, checkHasJournalEntries } from '@/services/journalService';

interface PlaceholderEntryManagerProps {
  userId: string | undefined;
  onPlaceholderCreated: (entryId: number) => void;
  isProfileChecked: boolean;
}

const PlaceholderEntryManager: React.FC<PlaceholderEntryManagerProps> = ({
  userId,
  onPlaceholderCreated,
  isProfileChecked
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Function to manage placeholder entry creation
  const checkAndCreatePlaceholder = useCallback(async () => {
    if (!userId || !isProfileChecked || isChecking || hasChecked) return;

    try {
      setIsChecking(true);
      
      // Check if the user already has journal entries
      const hasEntries = await checkHasJournalEntries(userId);
      
      if (!hasEntries) {
        console.log('[PlaceholderEntryManager] User has no entries, creating placeholder');
        const placeholderEntryId = await createPlaceholderEntry(userId);
        
        if (placeholderEntryId) {
          console.log('[PlaceholderEntryManager] Successfully created placeholder entry:', placeholderEntryId);
          onPlaceholderCreated(placeholderEntryId);
        } else {
          console.error('[PlaceholderEntryManager] Failed to create placeholder entry');
        }
      } else {
        console.log('[PlaceholderEntryManager] User already has entries, skipping placeholder creation');
      }
    } catch (error) {
      console.error('[PlaceholderEntryManager] Error in placeholder management:', error);
    } finally {
      setHasChecked(true);
      setIsChecking(false);
    }
  }, [userId, isProfileChecked, isChecking, hasChecked, onPlaceholderCreated]);

  // Check and create placeholder when conditions are met
  useEffect(() => {
    if (userId && isProfileChecked && !hasChecked && !isChecking) {
      checkAndCreatePlaceholder();
    }
  }, [userId, isProfileChecked, hasChecked, isChecking, checkAndCreatePlaceholder]);

  // This is a UI-less component that manages placeholder entries
  return null;
};

export default PlaceholderEntryManager;
