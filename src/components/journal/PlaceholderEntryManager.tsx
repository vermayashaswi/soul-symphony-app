
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createPlaceholderEntry } from '@/services/journalService';
import { Loader2 } from 'lucide-react';

interface PlaceholderEntryManagerProps {
  onEntryCreated: () => void;
  hasEntries: boolean;
  isProcessingFirstEntry: boolean;
}

const PlaceholderEntryManager: React.FC<PlaceholderEntryManagerProps> = ({ 
  onEntryCreated,
  hasEntries,
  isProcessingFirstEntry
}) => {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    // Only create a placeholder if:
    // 1. User is authenticated
    // 2. There are no entries
    // 3. Not already creating or completed
    // 4. Not already processing a first entry
    const shouldCreatePlaceholder = 
      !!user?.id && 
      !hasEntries && 
      !isCreating && 
      !isComplete && 
      !isProcessingFirstEntry;
    
    if (shouldCreatePlaceholder) {
      const createPlaceholder = async () => {
        setIsCreating(true);
        console.log('[PlaceholderEntryManager] Creating placeholder entry for user:', user.id);
        
        try {
          const success = await createPlaceholderEntry(user.id);
          
          if (success) {
            console.log('[PlaceholderEntryManager] Placeholder entry created successfully');
            setIsComplete(true);
            onEntryCreated(); // Notify parent component to refresh entries
          } else {
            console.error('[PlaceholderEntryManager] Failed to create placeholder entry');
          }
        } catch (error) {
          console.error('[PlaceholderEntryManager] Error in placeholder creation:', error);
        } finally {
          setIsCreating(false);
        }
      };
      
      createPlaceholder();
    }
  }, [user?.id, hasEntries, isCreating, isComplete, isProcessingFirstEntry, onEntryCreated]);
  
  // Don't render anything visible, this is a background process
  if (isCreating) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Preparing your journal...</span>
      </div>
    );
  }
  
  return null;
};

export default PlaceholderEntryManager;
