
import React, { useEffect, useRef } from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { processingStateManager } from '@/utils/journal/processing-state-manager';

interface JournalEntryLoadingSkeletonProps {
  count?: number;
  tempId?: string;
}

export default function JournalEntryLoadingSkeleton({ count = 1, tempId }: JournalEntryLoadingSkeletonProps) {
  const { addEvent } = useDebugLog();
  const mountTimeRef = useRef(Date.now());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (tempId) {
      console.log(`[JournalEntryLoadingSkeleton] Mounted with tempId ${tempId} at ${new Date().toISOString()}`);
      addEvent('LoadingUI', `JournalEntryLoadingSkeleton rendered with tempId ${tempId}`, 'info');
      
      // Dispatch event to indicate skeleton is visible
      window.dispatchEvent(new CustomEvent('processingCardDisplayed', {
        detail: { tempId, timestamp: Date.now() }
      }));
      
      // Register this entry with our processing state manager if it's not already tracked
      if (!processingStateManager.isProcessing(tempId)) {
        processingStateManager.startProcessing(tempId);
      }
      
      // Set up periodic check for real entry card
      checkIntervalRef.current = setInterval(() => {
        const realEntryCard = document.querySelector(`[data-temp-id="${tempId}"][data-processing="false"]`);
        if (realEntryCard) {
          console.log(`[JournalEntryLoadingSkeleton] Real entry card detected for ${tempId}, scheduling cleanup`);
          
          // Dispatch transition event
          window.dispatchEvent(new CustomEvent('processingCardTransitioning', {
            detail: { tempId, timestamp: Date.now() }
          }));
          
          // Clear the interval since we found the real card
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
        }
      }, 500); // Check every 500ms
    }
    
    return () => {
      // Notify when skeleton is unmounted
      if (tempId) {
        const visibleDuration = Date.now() - mountTimeRef.current;
        
        console.log(`[JournalEntryLoadingSkeleton] Unmounting skeleton with tempId ${tempId}. Was visible for ${visibleDuration}ms`);
        
        window.dispatchEvent(new CustomEvent('processingCardRemoved', {
          detail: { tempId, timestamp: Date.now(), visibleDuration }
        }));
      }
      
      // Clear interval on unmount
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [count, addEvent, tempId]);
  
  return (
    <div className="space-y-4 relative z-10">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={`skeleton-${tempId || index}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ 
            opacity: 0, 
            y: -10,
            transition: { duration: 0.3 }
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden skeleton-container"
          data-loading-skeleton={true}
          data-temp-id={tempId}
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
            
            {/* Enhanced processing indicator with better visibility */}
            <div className="absolute top-2 right-2 flex items-center justify-center h-8 w-8 bg-primary/30 rounded-full border-2 border-primary/50">
              <div className="h-5 w-5 rounded-full bg-primary/60 animate-ping absolute"></div>
              <div className="h-4 w-4 rounded-full bg-primary relative z-10"></div>
            </div>
            
            {/* Debug info */}
            {tempId && (
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground opacity-50" 
                   data-temp-id={tempId}>
                {tempId.substring(0, 8)}...
              </div>
            )}
            
            {/* Transition overlay for smooth handoff */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none transition-opacity duration-300" />
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
