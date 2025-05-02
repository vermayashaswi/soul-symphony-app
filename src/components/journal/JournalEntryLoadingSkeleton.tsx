
import React, { useEffect } from 'react';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useDebugLog } from '@/utils/debug/DebugContext';

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
    }
    
    return () => {
      // Notify when skeleton is unmounted
      if (tempId) {
        window.dispatchEvent(new CustomEvent('loadingSkeletonUnmounted', {
          detail: { tempId, timestamp: Date.now() }
        }));
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
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="overflow-hidden"
          data-loading-skeleton={true}
          data-temp-id={tempId}
          onAnimationStart={() => addEvent('LoadingUI', `Skeleton ${index} animation started${tempId ? ` for ${tempId}` : ''}`, 'info')}
          onAnimationComplete={() => addEvent('LoadingUI', `Skeleton ${index} animation completed${tempId ? ` for ${tempId}` : ''}`, 'info')}
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
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
