
import { useState, useEffect, useRef } from 'react';
import { getEntryIdForProcessingId } from '@/utils/audio-processing';

export function useProcessingVisibility(processingId: string | null, entryIds: Set<number>) {
  const [shouldShow, setShouldShow] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const checkVisibility = () => {
      if (!processingId) {
        setShouldShow(false);
        return;
      }

      // Check if this processing entry has a corresponding real entry
      const mappedEntryId = getEntryIdForProcessingId(processingId);
      if (mappedEntryId && entryIds.has(mappedEntryId)) {
        setShouldShow(false);
      }
    };

    // Check immediately
    checkVisibility();

    // Listen for actual entry loaded events
    const handleEntryLoaded = (event: CustomEvent) => {
      if (!mountedRef.current) return;
      
      const { tempId, entryId } = event.detail;
      if (tempId === processingId || 
          (event.detail.forceHideProcessing && processingId)) {
        setShouldShow(false);
      }
    };

    window.addEventListener('entryContentReady', handleEntryLoaded as EventListener);
    
    return () => {
      mountedRef.current = false;
      window.removeEventListener('entryContentReady', handleEntryLoaded as EventListener);
    };
  }, [processingId, entryIds]);

  return shouldShow;
}
