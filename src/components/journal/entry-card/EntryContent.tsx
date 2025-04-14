
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
  const contentAvailableRef = useRef(false);
  
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
    
    // CRITICAL FIX: Ensure loading state persists longer for long recordings
    if (contentIsLoading) {
      setShowLoading(true);
      contentAvailableRef.current = false;
    } else if (!contentAvailableRef.current) {
      // Only when transitioning from loading to content-available
      contentAvailableRef.current = true;
      
      // Delay showing content for a smoother transition
      // CRITICAL FIX: Use a longer timeout to ensure content is fully ready
      timeoutRef.current = setTimeout(() => {
        if (prevProcessingRef.current && !isProcessing) {
          // If transitioning from processing to done, delay a bit longer
          timeoutRef.current = setTimeout(() => {
            console.log('[EntryContent] Transitioning from loading to content display after delay');
            setShowLoading(false);
            setStableContent(content);
          }, 1200); // Increased from 800ms to 1200ms
        } else {
          console.log('[EntryContent] Setting content directly after processing check');
          setShowLoading(false);
          setStableContent(content);
        }
      }, 1500); // Increased from 1000ms to 1500ms
    }
    
    // Update refs
    prevProcessingRef.current = isProcessing;
    prevContentRef.current = content;
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, isProcessing, showLoading]);

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
