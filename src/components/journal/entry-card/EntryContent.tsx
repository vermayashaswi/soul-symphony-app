
import React, { useState, useEffect } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { AnimatePresence, motion } from 'framer-motion';
import { useDebugLog } from '@/utils/debug/DebugContext';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  const { addEvent } = useDebugLog();
  const [showLoading, setShowLoading] = useState(isProcessing);
  const [stableContent, setStableContent] = useState(content);
  
  // Force a minimum loading time of 0.5 seconds for better UX, reduced from 1 second
  const [forceLoading, setForceLoading] = useState(false);

  useEffect(() => {
    // When processing flag is true, always show loading state and preserve stable content
    if (isProcessing) {
      setShowLoading(true);
      setForceLoading(true);
      
      // Set a minimum loading time for better UX, but shorter than before
      const timer = setTimeout(() => {
        setForceLoading(false);
      }, 500); // Reduced from 1000ms to 500ms for faster response
      
      return () => clearTimeout(timer);
    }

    const contentIsLoading = !content || 
                          content === "Processing entry..." || 
                          content.trim() === "" ||
                          content === "Loading...";

    if (contentIsLoading) {
      setShowLoading(true);
    } else if (!forceLoading) {
      // Only update stable content and hide loader when not processing
      // and we have valid content, and not in forced loading state
      setShowLoading(false);
      setStableContent(content);
      
      // Dispatch an event to notify that content is ready
      window.dispatchEvent(new CustomEvent('entryContentReady', { 
        detail: { content }
      }));
    }
    
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: contentIsLoading,
      forceLoading
    });
    
  }, [content, isProcessing, addEvent, forceLoading]);
  // Removed isExpanded from dependencies as it shouldn't affect loader visibility

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(showLoading || forceLoading) ? (
        <LoadingEntryContent key="loading" />
      ) : isExpanded ? (
        <motion.div
          key="expanded"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-xs md:text-sm text-foreground">{stableContent}</p>
        </motion.div>
      ) : (
        <motion.p
          key="collapsed" 
          className="text-xs md:text-sm text-foreground line-clamp-3"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }}
          transition={{ duration: 0.2 }}
        >
          {stableContent}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
