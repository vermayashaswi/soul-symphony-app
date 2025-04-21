
import React, { useState, useEffect } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { AnimatePresence, motion } from 'framer-motion';
import { useDebugLog } from '@/utils/debug/DebugContext';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
  maxLength?: number; // Optional max length for content optimization
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing = false,
  maxLength
}: EntryContentProps) {
  const { addEvent } = useDebugLog();
  const [showLoading, setShowLoading] = useState(isProcessing);
  const [stableContent, setStableContent] = useState(content);
  
  // Force a minimum loading time of 2 seconds for better UX
  const [forceLoading, setForceLoading] = useState(false);

  // Optimize content if maxLength is provided
  const optimizedContent = maxLength && content && content.length > maxLength
    ? `${content.substring(0, maxLength)}...`
    : content;

  useEffect(() => {
    // When processing flag is true, always show loading state and preserve stable content
    if (isProcessing) {
      setShowLoading(true);
      setForceLoading(true);
      
      // Set a minimum loading time for better UX
      const timer = setTimeout(() => {
        setForceLoading(false);
      }, 2000);
      
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
      setStableContent(maxLength && content.length > maxLength
        ? `${content.substring(0, maxLength)}...`
        : content);
    }
    
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      optimizedLength: optimizedContent?.length || 0,
      isOptimized: maxLength ? content?.length > maxLength : false,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: contentIsLoading,
      forceLoading
    });
    
  }, [content, isProcessing, addEvent, forceLoading, maxLength, optimizedContent]);
  // Removed isExpanded from dependencies as it shouldn't affect loader visibility

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(showLoading || forceLoading) ? (
        <LoadingEntryContent key="loading" />
      ) : isExpanded ? (
        <motion.div
          key="expanded"
          initial={{ opacity: 0.7 }} // Changed from 0 to 0.7 to avoid framer-motion warning
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }} // Changed from 0 to 0.7 to avoid framer-motion warning
          transition={{ duration: 0.2 }}
        >
          <p className="text-xs md:text-sm text-foreground">{stableContent}</p>
        </motion.div>
      ) : (
        <motion.p
          key="collapsed" 
          className="text-xs md:text-sm text-foreground line-clamp-3"
          initial={{ opacity: 0.7 }} // Changed from 0 to 0.7 to avoid framer-motion warning
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }} // Changed from 0 to 0.7 to avoid framer-motion warning
          transition={{ duration: 0.2 }}
        >
          {stableContent}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
