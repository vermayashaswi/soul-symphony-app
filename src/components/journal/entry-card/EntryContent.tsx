
import React, { useState, useEffect, useRef } from 'react';
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
  const [transitionInProgress, setTransitionInProgress] = useState(false);
  const contentAvailableRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update content immediately when it changes
  useEffect(() => {
    if (content && content !== "Processing entry..." && content !== "Loading...") {
      setStableContent(content);
    }
  }, [content]);

  // Debug logging
  useEffect(() => {
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      transitionInProgress,
      contentEmpty: !content || content === "Processing entry..." || content.trim() === "" || content === "Loading...",
      stableContentSet: stableContent === content
    });
  }, [content, isProcessing, isExpanded, showLoading, stableContent, transitionInProgress, addEvent]);

  useEffect(() => {
    if (isProcessing && !showLoading) {
      addEvent('EntryContent', 'Processing started, showing loading state immediately', 'info');
      setShowLoading(true);
      return;
    }

    const contentIsLoading = isProcessing || 
                          !content || 
                          content === "Processing entry..." || 
                          content.trim() === "" ||
                          content === "Loading...";

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (contentIsLoading) {
      setShowLoading(true);
      contentAvailableRef.current = false;
    } else {
      // Content is available - update immediately
      contentAvailableRef.current = true;
      setShowLoading(false);
      setStableContent(content);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, isProcessing, addEvent]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {showLoading ? (
        <LoadingEntryContent key="loading" />
      ) : isExpanded ? (
        <motion.div
          key="expanded"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-xs md:text-sm text-foreground">{stableContent}</p>
        </motion.div>
      ) : (
        <motion.p
          key="collapsed" 
          className="text-xs md:text-sm text-foreground line-clamp-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {stableContent}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
