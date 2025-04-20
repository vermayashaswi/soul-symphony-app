
import React, { useState, useEffect } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { AnimatePresence, motion } from 'framer-motion';
import { useDebugLog } from '@/utils/debug/DebugContext';

interface EntryContentProps {
  content: string;
  showFullContent: boolean;
  isProcessing?: boolean;
  contentRef?: React.RefObject<HTMLDivElement>;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  setShowScrollbar?: React.Dispatch<React.SetStateAction<boolean>>;
  isEntryContentMounted?: boolean;
  setIsEntryContentMounted?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function EntryContent({ 
  content, 
  showFullContent, 
  isProcessing = false,
  contentRef,
  scrollContainerRef,
  setShowScrollbar,
  isEntryContentMounted,
  setIsEntryContentMounted
}: EntryContentProps) {
  const { addEvent } = useDebugLog();
  const [showLoading, setShowLoading] = useState(isProcessing);
  const [stableContent, setStableContent] = useState(content);
  
  // Force a minimum loading time of 2 seconds for better UX
  const [forceLoading, setForceLoading] = useState(false);

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
      setStableContent(content);
    }
    
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded: showFullContent,
      showLoading,
      contentEmpty: contentIsLoading,
      forceLoading
    });
    
    // Notify parent component that content is mounted if callback exists
    if (setIsEntryContentMounted) {
      setIsEntryContentMounted(true);
    }
    
  }, [content, isProcessing, addEvent, forceLoading, showFullContent, setIsEntryContentMounted]);

  useEffect(() => {
    // Update scrollbar visibility when content or expanded state changes if we have refs
    if (contentRef?.current && setShowScrollbar) {
      const scrollHeight = contentRef.current.scrollHeight;
      const clientHeight = contentRef.current.clientHeight;
      setShowScrollbar(scrollHeight > clientHeight);
    }
  }, [showFullContent, isEntryContentMounted, contentRef, setShowScrollbar]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(showLoading || forceLoading) ? (
        <LoadingEntryContent key="loading" />
      ) : showFullContent ? (
        <motion.div
          key="expanded"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }}
          transition={{ duration: 0.2 }}
          ref={contentRef as React.RefObject<HTMLDivElement>}
        >
          <div ref={scrollContainerRef as React.RefObject<HTMLDivElement>}>
            <p className="text-xs md:text-sm text-foreground">{stableContent}</p>
          </div>
        </motion.div>
      ) : (
        <motion.p
          key="collapsed" 
          className="text-xs md:text-sm text-foreground line-clamp-3"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }}
          transition={{ duration: 0.2 }}
          ref={contentRef as React.RefObject<HTMLDivElement>}
        >
          {stableContent}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
