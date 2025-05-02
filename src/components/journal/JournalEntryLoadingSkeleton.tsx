
import React, { useEffect } from 'react';
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
  
  useEffect(() => {
    addEvent('LoadingUI', `JournalEntryLoadingSkeleton rendered with ${count} items${tempId ? ` and tempId ${tempId}` : ''}`, 'info');
    
    // Dispatch event to indicate skeleton is visible
    if (tempId) {
      window.dispatchEvent(new CustomEvent('loadingSkeletonVisible', {
        detail: { tempId, timestamp: Date.now() }
      }));
      
      // Register this entry with our processing state manager if it's not already tracked
      if (!processingStateManager.isProcessing(tempId)) {
        processingStateManager.startProcessing(tempId);
      }
    }
    
    // Add a delayed visibility notification to help with tracking
    const visibilityTimeout = setTimeout(() => {
      console.log('[JournalEntryLoadingSkeleton] Skeleton has been visible for 500ms');
      
      if (tempId) {
        window.dispatchEvent(new CustomEvent('loadingSkeletonStillVisible', {
          detail: { tempId, timestamp: Date.now(), duration: 500 }
        }));
      }
    }, 500);
    
    // Add a longer timeout to ensure we stay visible
    const longVisibilityTimeout = setTimeout(() => {
      console.log('[JournalEntryLoadingSkeleton] Skeleton has been visible for 2s');
      
      if (tempId) {
        window.dispatchEvent(new CustomEvent('loadingSkeletonLongVisible', {
          detail: { tempId, timestamp: Date.now(), duration: 2000 }
        }));
      }
    }, 2000);
    
    return () => {
      // Notify when skeleton is unmounted
      if (tempId) {
        window.dispatchEvent(new CustomEvent('loadingSkeletonUnmounted', {
          detail: { tempId, timestamp: Date.now() }
        }));
      }
      
      clearTimeout(visibilityTimeout);
      clearTimeout(longVisibilityTimeout);
    };
  }, [count, addEvent, tempId]);
  
  return (
    <div className="space-y-4 relative z-10">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={`skeleton-${tempId || index}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="overflow-hidden skeleton-container"
          data-loading-skeleton={true}
          data-temp-id={tempId}
          onAnimationStart={() => addEvent('LoadingUI', `Skeleton ${index} animation started${tempId ? ` for ${tempId}` : ''}`, 'info')}
          onAnimationComplete={() => {
            addEvent('LoadingUI', `Skeleton ${index} animation completed${tempId ? ` for ${tempId}` : ''}`, 'info');
            
            // Dispatch an event when animation is complete to help with tracking
            if (tempId) {
              window.dispatchEvent(new CustomEvent('loadingSkeletonAnimated', {
                detail: { tempId, timestamp: Date.now(), index }
              }));
            }
          }}
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
