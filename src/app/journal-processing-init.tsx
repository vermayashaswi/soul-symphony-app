
import { useEffect } from 'react';
import { initializeJournalProcessing } from '@/utils/journal/initialize-processing';

export function JournalProcessingInitializer() {
  useEffect(() => {
    const { processingStateManager } = initializeJournalProcessing();
    
    // Cleanup on unmount
    return () => {
      processingStateManager.dispose();
    };
  }, []);
  
  // This component doesn't render anything
  return null;
}
