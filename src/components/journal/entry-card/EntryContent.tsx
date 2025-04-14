import React, { useState, useEffect, useRef } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { AnimatePresence, motion } from 'framer-motion';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  const [showLoading, setShowLoading] = useState(isProcessing);
  const [stableContent, setStableContent] = useState(content);
  const prevProcessingRef = useRef(isProcessing);
  const prevContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add new logging for debugging
  useEffect(() => {
    console.log('[EntryContent] Received content update:', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      contentIsEmpty: !content || content === "Processing entry..." || content.trim() === "" || content === "Loading..."
    });
  }, [content, isProcessing, isExpanded]);
  
  // Detect when content is actually available and worth showing
  useEffect(() => {
    const contentIsLoading = isProcessing || 
                          !content || 
                          content === "Processing entry..." || 
                          content.trim() === "" ||
                          content === "Loading...";
    
    console.log('[EntryContent] Content status check:', {
      contentIsLoading,
      isProcessing,
      content: content?.substring(0, 20) + (content?.length > 20 ? '...' : ''),
      currentlyShowingLoader: showLoading
    });
    
    // Clear any existing timeout to prevent race conditions
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Keep showing loading state while content is being processed
    // Only transition to content when we have meaningful text to display
    if (contentIsLoading) {
      timeoutRef.current = setTimeout(() => {
        setShowLoading(true);
      }, 150);
    } else {
      // If we have valid content, delay a bit for a smooth transition
      timeoutRef.current = setTimeout(() => {
        if (prevProcessingRef.current && !isProcessing) {
          // If transitioning from processing to done, delay a bit longer
          setTimeout(() => {
            setShowLoading(false);
            setStableContent(content);
          }, 800);
        } else {
          setShowLoading(false);
          setStableContent(content);
        }
      }, 500);
    }
    
    // Update refs
    prevProcessingRef.current = isProcessing;
    prevContentRef.current = content;
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, isProcessing]);

  return (
    <AnimatePresence mode="wait">
      {showLoading ? (
        <LoadingEntryContent key="loading" />
      ) : isExpanded ? (
        <motion.div
          key="expanded"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
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
          transition={{ duration: 0.3 }}
        >
          {stableContent}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
