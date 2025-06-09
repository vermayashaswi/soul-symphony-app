
import React, { useEffect, useRef } from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { processingStateManager } from '@/utils/journal/processing-state-manager';

interface JournalEntryLoadingSkeletonProps {
  count?: number;
  tempId?: string;
  isVisible?: boolean;
}

export default function JournalEntryLoadingSkeleton({ 
  count = 1, 
  tempId, 
  isVisible = true 
}: JournalEntryLoadingSkeletonProps) {
  const { addEvent } = useDebugLog();
  const mountTimeRef = useRef(Date.now());
  const [shouldRender, setShouldRender] = React.useState(isVisible);
  
  useEffect(() => {
    if (tempId) {
      console.log(`[JournalEntryLoadingSkeleton] Mounted with tempId ${tempId}, visible: ${isVisible}`);
      addEvent('LoadingUI', `JournalEntryLoadingSkeleton rendered with tempId ${tempId}`, 'info');
      
      // Listen for hide events
      const handleHidden = (event: CustomEvent) => {
        if (event.detail.tempId === tempId) {
          console.log(`[JournalEntryLoadingSkeleton] Hide event received for ${tempId}`);
          setShouldRender(false);
        }
      };
      
      // Listen for real entry detection with faster polling
      const handleRealEntryDetected = () => {
        const hasRealEntry = document.querySelector(`[data-temp-id="${tempId}"][data-processing="false"]`) ||
                            document.querySelector(`[data-temp-id="${tempId}"].journal-entry-card:not(.processing-card)`);
        
        if (hasRealEntry) {
          console.log(`[JournalEntryLoadingSkeleton] Real entry detected for ${tempId}, hiding immediately`);
          processingStateManager.hideEntry(tempId);
          setShouldRender(false);
        }
      };
      
      // Very fast polling for real entry detection
      const pollInterval = setInterval(handleRealEntryDetected, 100);
      
      window.addEventListener('processingEntryHidden', handleHidden as EventListener);
      
      // Initial check
      setTimeout(handleRealEntryDetected, 50);
      
      return () => {
        clearInterval(pollInterval);
        window.removeEventListener('processingEntryHidden', handleHidden as EventListener);
        
        if (tempId) {
          const visibleDuration = Date.now() - mountTimeRef.current;
          console.log(`[JournalEntryLoadingSkeleton] Unmounting skeleton with tempId ${tempId}. Was visible for ${visibleDuration}ms`);
        }
      };
    }
  }, [tempId, addEvent, isVisible]);
  
  // SIMPLIFIED: Always show when prop says to show
  useEffect(() => {
    setShouldRender(isVisible);
  }, [isVisible]);
  
  // FORCE VISIBILITY during critical first moments
  const finalShouldRender = isVisible || shouldRender;
  
  if (!finalShouldRender) {
    return null;
  }
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`skeleton-${tempId}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }} // Always animate to visible
        exit={{ 
          opacity: 0, 
          y: -10,
          transition: { duration: 0.15 }
        }}
        transition={{ duration: 0.15 }}
        className="overflow-hidden skeleton-container"
        data-loading-skeleton={true}
        data-temp-id={tempId}
        style={{ 
          opacity: 1, // FORCE OPACITY
          visibility: 'visible', // FORCE VISIBILITY
          display: 'block', // FORCE DISPLAY
          transition: 'opacity 0.15s ease-out'
        }}
      >
        <Card className="p-4 bg-card border-2 border-primary/20 shadow-md relative journal-entry-card processing-card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <ShimmerSkeleton className="h-5 w-32 mb-2" />
              <div className="flex items-center">
                <ShimmerSkeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ShimmerSkeleton className="h-8 w-8 rounded-md" />
              <ShimmerSkeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
          
          <LoadingEntryContent />
          
          {/* Processing indicator */}
          <div className="absolute top-2 right-2 flex items-center justify-center h-8 w-8 bg-primary/30 rounded-full border-2 border-primary/50">
            <div className="h-5 w-5 rounded-full bg-primary/60 animate-ping absolute"></div>
            <div className="h-4 w-4 rounded-full bg-primary relative z-10"></div>
          </div>
          
          {/* Debug info - now completely invisible */}
          {tempId && (
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground opacity-0" 
                 data-temp-id={tempId}>
              {tempId.substring(0, 8)}...
            </div>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
