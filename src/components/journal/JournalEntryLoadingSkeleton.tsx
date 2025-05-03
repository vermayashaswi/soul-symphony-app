
import React, { useEffect, useRef, useState } from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { processingStateManager, EntryProcessingState } from '@/utils/journal/processing-state-manager';

interface JournalEntryLoadingSkeletonProps {
  count?: number;
  tempId?: string; // Add support for temp ID to track specific skeletons
}

export default function JournalEntryLoadingSkeleton({ count = 1, tempId }: JournalEntryLoadingSkeletonProps) {
  const { addEvent } = useDebugLog();
  const isVisibleRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const forceRemoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [shouldRender, setShouldRender] = useState(true);
  const isUnmountingRef = useRef(false);
  const processedEntryIdsRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    if (tempId) {
      console.log(`[JournalEntryLoadingSkeleton] Mounted with tempId ${tempId} at ${new Date().toISOString()}`);
      addEvent('LoadingUI', `JournalEntryLoadingSkeleton rendered with tempId ${tempId}`, 'info');
      
      // Mark this skeleton as visible
      isVisibleRef.current = true;
      
      // Dispatch event to indicate skeleton is visible
      window.dispatchEvent(new CustomEvent('processingCardDisplayed', {
        detail: { tempId, timestamp: Date.now() }
      }));
      
      // Register this entry with our processing state manager if it's not already tracked
      if (!processingStateManager.isProcessing(tempId)) {
        processingStateManager.startProcessing(tempId);
      }
      
      // Check if this entry is already mapped to a real entry ID
      const entryId = processingStateManager.getEntryId(tempId);
      if (entryId) {
        console.log(`[JournalEntryLoadingSkeleton] Skeleton ${tempId} already has entryId ${entryId}, starting removal countdown`);
        processedEntryIdsRef.current.add(entryId);
        
        // Start removal countdown if we already have an entry ID
        setTimeout(() => {
          if (!isUnmountingRef.current) {
            console.log(`[JournalEntryLoadingSkeleton] Auto-removing skeleton for ${tempId} with entryId ${entryId}`);
            isUnmountingRef.current = true;
            setShouldRender(false);
            
            // Also update the processing state
            processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
            setTimeout(() => {
              processingStateManager.removeEntry(tempId);
            }, 300);
          }
        }, 100);
      }
      
      // Listen for entry content ready events specific to this tempId
      const handleEntryProcessed = (event: CustomEvent) => {
        if (event.detail && event.detail.tempId === tempId && !isUnmountingRef.current) {
          console.log(`[JournalEntryLoadingSkeleton] Entry processed for ${tempId}, initiating removal`);
          
          // Mark that we're unmounting to prevent duplicate removals
          isUnmountingRef.current = true;
          setShouldRender(false);
          
          if (event.detail.entryId) {
            processedEntryIdsRef.current.add(event.detail.entryId);
          }
        }
      };
      
      // Also listen for mapping events
      const handleEntryMapped = (event: CustomEvent) => {
        if (event.detail && event.detail.tempId === tempId && event.detail.entryId && !isUnmountingRef.current) {
          console.log(`[JournalEntryLoadingSkeleton] Entry mapped: ${tempId} -> ${event.detail.entryId}, initiating removal`);
          
          processedEntryIdsRef.current.add(event.detail.entryId);
          
          // Mark that we're unmounting to prevent duplicate removals
          isUnmountingRef.current = true;
          setShouldRender(false);
        }
      };
      
      window.addEventListener('entryProcessingComplete', handleEntryProcessed as EventListener);
      window.addEventListener('processingEntryMapped', handleEntryMapped as EventListener);
    }
    
    // Add listener for force remove events
    const handleForceRemove = (event: CustomEvent<any>) => {
      if (!event.detail) return;
      
      if ((event.detail.tempId === tempId || !event.detail.tempId) && !isUnmountingRef.current) {
        console.log(`[JournalEntryLoadingSkeleton] Received force remove event for ${tempId || 'all cards'}`);
        if (forceRemoveTimeoutRef.current) {
          clearTimeout(forceRemoveTimeoutRef.current);
        }
        
        // Directly notify that card is being removed
        isVisibleRef.current = false;
        isUnmountingRef.current = true;
        setShouldRender(false);
        
        window.dispatchEvent(new CustomEvent('processingCardRemoved', {
          detail: { tempId, timestamp: Date.now(), forceRemoved: true }
        }));
      }
    };
    
    window.addEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
    window.addEventListener('forceRemoveAllProcessingCards', handleForceRemove as EventListener);
    
    // Add a delayed visibility notification to help with tracking
    const visibilityTimeout = setTimeout(() => {
      if (isVisibleRef.current && tempId) {
        console.log(`[JournalEntryLoadingSkeleton] Skeleton ${tempId} has been visible for 500ms`);
        
        window.dispatchEvent(new CustomEvent('loadingSkeletonStillVisible', {
          detail: { tempId, timestamp: Date.now(), duration: 500 }
        }));
      }
    }, 500);
    
    // Add a safety timeout to force remove this skeleton after 15 seconds
    // This prevents skeletons from getting "stuck" in the UI
    forceRemoveTimeoutRef.current = setTimeout(() => {
      if (tempId && isVisibleRef.current && !isUnmountingRef.current) {
        console.log(`[JournalEntryLoadingSkeleton] Force removing skeleton ${tempId} after timeout`);
        isVisibleRef.current = false;
        isUnmountingRef.current = true;
        setShouldRender(false);
        
        processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
        processingStateManager.removeEntry(tempId);
        
        // Dispatch event to force UI update elsewhere
        window.dispatchEvent(new CustomEvent('processingCardRemoved', {
          detail: { tempId, timestamp: Date.now(), forceRemoved: true, reason: 'timeout' }
        }));
        
        window.dispatchEvent(new CustomEvent('journalUIForceRefresh', {
          detail: { timestamp: Date.now(), forceRemove: tempId, reason: 'timeout' }
        }));
      }
    }, 15000);
    
    return () => {
      // Notify when skeleton is unmounted
      if (tempId) {
        const visibleDuration = Date.now() - mountTimeRef.current;
        
        console.log(`[JournalEntryLoadingSkeleton] Unmounting skeleton with tempId ${tempId}. Was visible for ${visibleDuration}ms`);
        isVisibleRef.current = false;
        isUnmountingRef.current = true;
        
        window.dispatchEvent(new CustomEvent('processingCardRemoved', {
          detail: { tempId, timestamp: Date.now(), visibleDuration }
        }));
        
        // Also clean up the processing state
        const entryId = processingStateManager.getEntryId(tempId);
        if (entryId) {
          processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
          setTimeout(() => {
            processingStateManager.removeEntry(tempId);
          }, 300);
        }
      }
      
      // Clean up all timeouts and event listeners
      clearTimeout(visibilityTimeout);
      if (forceRemoveTimeoutRef.current) {
        clearTimeout(forceRemoveTimeoutRef.current);
      }
      window.removeEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
      window.removeEventListener('forceRemoveAllProcessingCards', handleForceRemove as EventListener);
      window.removeEventListener('entryProcessingComplete', handleEntryProcessed as EventListener);
      window.removeEventListener('processingEntryMapped', handleEntryMapped as EventListener);
    };
  }, [count, addEvent, tempId]);
  
  const handleAnimationComplete = () => {
    if (tempId) {
      console.log(`[JournalEntryLoadingSkeleton] Animation completed for ${tempId}`);
      
      // Dispatch an event when animation is complete to help with tracking
      window.dispatchEvent(new CustomEvent('loadingSkeletonAnimated', {
        detail: { tempId, timestamp: Date.now() }
      }));
    }
  };
  
  // Don't render if we shouldn't
  if (!shouldRender) {
    return null;
  }
  
  return (
    <div className="space-y-4 relative z-10">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={`skeleton-${tempId || index}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden skeleton-container"
          data-loading-skeleton={true}
          data-temp-id={tempId}
          onAnimationComplete={handleAnimationComplete}
        >
          <Card className="p-4 bg-card border-2 border-primary/20 shadow-md relative journal-entry-card processing-card highlight-processing">
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
            
            {/* Add a processing indicator that's always visible */}
            <div className="absolute top-2 right-2 flex items-center justify-center h-6 w-6 bg-primary/20 rounded-full pulsing-indicator">
              <div className="h-4 w-4 rounded-full bg-primary/40 animate-ping absolute"></div>
              <div className="h-3 w-3 rounded-full bg-primary/80"></div>
            </div>
            
            {/* Add the tempId as a data attribute for debugging */}
            {tempId && (
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground opacity-50" 
                   data-temp-id={tempId}>
                {tempId.substring(0, 8)}...
              </div>
            )}
          </Card>
        </motion.div>
      ))}
      
      {/* Hidden style to add pulsing indicator effect */}
      <style>{`
        .highlight-processing {
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1), 0 0 15px rgba(var(--primary-rgb), 0.2);
          position: relative;
          overflow: hidden;
        }
        
        .highlight-processing::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(to right, transparent, hsl(var(--primary)), transparent);
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .pulsing-indicator {
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
