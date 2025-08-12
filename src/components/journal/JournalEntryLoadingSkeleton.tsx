
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

const JournalEntryLoadingSkeleton: React.FC<JournalEntryLoadingSkeletonProps> = ({ 
  count = 1, 
  tempId,
  isVisible = true
}) => {
  const { log } = useDebugLog();
  const componentRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = React.useState(isVisible);
  
  useEffect(() => {
    if (tempId) {
      log(`[JournalEntryLoadingSkeleton] Component mounted for tempId: ${tempId}, isVisible: ${isVisible}`);
    }
  }, [tempId, isVisible, log]);
  
  // Listen for immediate removal events
  useEffect(() => {
    const handleForceRemove = (event: CustomEvent) => {
      if (event.detail?.tempId === tempId || event.detail?.tempId === 'all') {
        console.log(`[JournalEntryLoadingSkeleton] Force remove event received for ${tempId}`);
        setShouldRender(false);
        // Removed immediate DOM manipulation; let React + AnimatePresence handle unmount smoothly
      }
    };
    
    const handleProcessingCompleted = (event: CustomEvent) => {
      if (event.detail?.tempId === tempId) {
        console.log(`[JournalEntryLoadingSkeleton] Processing completed event received for ${tempId}`);
        setShouldRender(false);
        // Removed immediate DOM manipulation; rely on React unmount
      }
    };
    
    window.addEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
    window.addEventListener('forceRemoveLoadingContent', handleForceRemove as EventListener);
    window.addEventListener('forceRemoveAllProcessingCards', handleForceRemove as EventListener);
    window.addEventListener('forceRemoveAllLoadingContent', handleForceRemove as EventListener);
    window.addEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
    
    return () => {
      window.removeEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
      window.removeEventListener('forceRemoveLoadingContent', handleForceRemove as EventListener);
      window.removeEventListener('forceRemoveAllProcessingCards', handleForceRemove as EventListener);
      window.removeEventListener('forceRemoveAllLoadingContent', handleForceRemove as EventListener);
      window.removeEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
    };
  }, [tempId]);
  
  // Update visibility immediately based on props
  useEffect(() => {
    setShouldRender(isVisible);
    if (!isVisible && componentRef.current) {
      componentRef.current.style.display = 'none';
    }
  }, [isVisible]);
  
  if (!shouldRender) {
    return null;
  }
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={componentRef}
        key={tempId || 'loading-skeleton'}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }} // Faster exit animation
        transition={{ duration: 0.2 }} // Faster entrance animation
        className="processing-card"
        data-temp-id={tempId}
        data-loading-skeleton="true"
      >
        {Array.from({ length: count }).map((_, index) => (
          <Card key={index} className="journal-entry-card processing-card p-6 mb-4 border border-slate-200/20 bg-gradient-to-br from-slate-50/50 to-white/50 dark:from-slate-900/50 dark:to-slate-800/50">
            <LoadingEntryContent />
          </Card>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default JournalEntryLoadingSkeleton;
