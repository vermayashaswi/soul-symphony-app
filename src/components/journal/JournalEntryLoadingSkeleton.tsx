import React, { useEffect, useRef } from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { processingStateManager } from '@/utils/journal/processing-state-manager';

interface JournalEntryLoadingSkeletonProps {
  count?: number;
  tempId?: string; // Add support for temp ID to track specific skeletons
}

export default function JournalEntryLoadingSkeleton({ count = 1, tempId }: JournalEntryLoadingSkeletonProps) {
  const { addEvent } = useDebugLog();
  const isVisibleRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const forceRemoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRefsMap = useRef<Map<number, HTMLElement | null>>(new Map());
  const isMountedRef = useRef(true);
  
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
    }
    
    return () => {
      isMountedRef.current = false;
      
      // Clean up timeouts
      if (forceRemoveTimeoutRef.current) {
        clearTimeout(forceRemoveTimeoutRef.current);
        forceRemoveTimeoutRef.current = null;
      }
      
      // Notify when skeleton is unmounted
      if (tempId) {
        const visibleDuration = Date.now() - mountTimeRef.current;
        
        console.log(`[JournalEntryLoadingSkeleton] Unmounting skeleton with tempId ${tempId}. Was visible for ${visibleDuration}ms`);
        isVisibleRef.current = false;
        
        window.dispatchEvent(new CustomEvent('processingCardRemoved', {
          detail: { tempId, timestamp: Date.now(), visibleDuration }
        }));
      }
    };
  }, [tempId, addEvent]);
  
  useEffect(() => {
    // Add listener for force remove events
    const handleForceRemove = (event: CustomEvent<any>) => {
      if (!event.detail) return;
      
      if (event.detail.tempId === tempId || !event.detail.tempId) {
        console.log(`[JournalEntryLoadingSkeleton] Received force remove event for ${tempId || 'all cards'}`);
        if (forceRemoveTimeoutRef.current) {
          clearTimeout(forceRemoveTimeoutRef.current);
        }
        
        // Directly notify that card is being removed
        isVisibleRef.current = false;
        window.dispatchEvent(new CustomEvent('processingCardRemoved', {
          detail: { tempId, timestamp: Date.now(), forceRemoved: true }
        }));
      }
    };
    
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
      if (tempId && isMountedRef.current) {
        console.log(`[JournalEntryLoadingSkeleton] Force removing skeleton ${tempId} after timeout`);
        isVisibleRef.current = false;
        processingStateManager.removeEntry(tempId);
        
        // Dispatch event to force UI update elsewhere
        window.dispatchEvent(new CustomEvent('processingCardRemoved', {
          detail: { tempId, timestamp: Date.now(), forceRemoved: true }
        }));
        
        window.dispatchEvent(new CustomEvent('journalUIForceRefresh', {
          detail: { timestamp: Date.now(), forceRemove: tempId }
        }));
      }
    }, 15000);
    
    window.addEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
    window.addEventListener('forceRemoveAllProcessingCards', handleForceRemove as EventListener);
    
    return () => {
      // Clean up all timeouts and event listeners
      clearTimeout(visibilityTimeout);
      if (forceRemoveTimeoutRef.current) {
        clearTimeout(forceRemoveTimeoutRef.current);
      }
      window.removeEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
      window.removeEventListener('forceRemoveAllProcessingCards', handleForceRemove as EventListener);
    };
  }, [count, tempId]);
  
  const handleAnimationComplete = () => {
    if (tempId) {
      console.log(`[JournalEntryLoadingSkeleton] Animation completed for ${tempId}`);
      
      // Dispatch an event when animation is complete to help with tracking
      window.dispatchEvent(new CustomEvent('loadingSkeletonAnimated', {
        detail: { tempId, timestamp: Date.now() }
      }));
    }
  };
  
  // Safe DOM removal function
  const removeCardSafely = (cardElement: HTMLElement | null) => {
    try {
      if (!cardElement || !cardElement.parentNode || !isMountedRef.current) {
        return;
      }
      
      // First make it invisible but keep in DOM
      cardElement.classList.add('instant-hide-card');
      cardElement.classList.add('processing-card-removing');
      
      // Then safely remove it after animation
      setTimeout(() => {
        try {
          if (cardElement && cardElement.parentNode && isMountedRef.current) {
            cardElement.parentNode.removeChild(cardElement);
            console.log('[JournalEntryLoadingSkeleton] Parent card removed from DOM');
            
            // Notify that this card has been removed
            if (tempId) {
              window.dispatchEvent(new CustomEvent('processingCardRemoved', {
                detail: { 
                  tempId, 
                  timestamp: Date.now() 
                }
              }));
            }
          }
        } catch (e) {
          console.error('[JournalEntryLoadingSkeleton] Error safely removing card from DOM:', e);
        }
      }, 300);
    } catch (e) {
      console.error('[JournalEntryLoadingSkeleton] Error in removeCardSafely:', e);
    }
  };
  
  const saveCardRef = (index: number) => (el: HTMLDivElement | null) => {
    if (el) {
      cardRefsMap.current.set(index, el);
    }
  };
  
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
          ref={saveCardRef(index)}
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
            
            <LoadingEntryContent tempId={tempId} />
            
            {/* Add a processing indicator that's always visible */}
            <div className="absolute top-2 right-2 flex items-center justify-center h-6 w-6 bg-primary/20 rounded-full pulsing-indicator">
              <div className="h-4 w-4 rounded-full bg-primary/40 animate-ping absolute"></div>
              <div className="h-3 w-3 rounded-full bg-primary/80"></div>
            </div>
            
            {/* Add the tempId as a data attribute for debugging but make it invisible */}
            {tempId && (
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground opacity-0" 
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
        
        .instant-hide-card {
          position: absolute !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -1 !important;
        }
        
        .processing-card-removing {
          opacity: 0;
          transform: translateY(-10px);
          pointer-events: none;
          transition: opacity 0.3s ease-out, transform 0.3s ease-out;
          z-index: -1;
        }
        
        .processing-active .journal-entry-card.processing-card {
          border-color: hsl(var(--primary)/0.5);
          border-width: 2px;
        }
        
        .journal-entry-card {
          position: relative;
          z-index: 10;
        }
      `}</style>
    </div>
  );
}
