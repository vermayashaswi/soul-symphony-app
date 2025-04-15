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
  
  // Debug logging
  useEffect(() => {
    console.log('[EntryContent] State update:', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: !content || content === "Processing entry..." || content.trim() === "" || content === "Loading...",
      stableContentSet: stableContent === content
    });
  }, [content, isProcessing, isExpanded, showLoading, stableContent]);
  
  // Handle content and loading state transitions
  useEffect(() => {
    const contentIsLoading = isProcessing || 
                          !content || 
                          content === "Processing entry..." || 
                          content.trim() === "" ||
                          content === "Loading...";
    
    console.log('[EntryContent] Content status check:', {
      contentIsLoading,
      isProcessing,
      contentSample: content?.substring(0, 20) + (content?.length > 20 ? '...' : ''),
      showLoading
    });
    
    // Clear any existing timeout to prevent race conditions
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (contentIsLoading) {
      // Show loading state
      setShowLoading(true);
      contentAvailableRef.current = false;
    } else if (!contentAvailableRef.current) {
      // Content is now available - transition from loading to content display
      contentAvailableRef.current = true;
      
      // Keep loading state visible for a moment for better UX
      const delayTime = prevProcessingRef.current && !isProcessing ? 2000 : 1000;
      
      console.log(`[EntryContent] Content available, will show after ${delayTime}ms delay`);
      
      timeoutRef.current = setTimeout(() => {
        console.log('[EntryContent] Transitioning from loading to content display');
        setShowLoading(false);
        setStableContent(content);
      }, delayTime);
    } else if (content !== stableContent && !showLoading) {
      // Content has changed while already displaying content (not during loading)
      console.log('[EntryContent] Content updated while already showing content');
      setStableContent(content);
    }
    
    // Update refs for next comparison
    prevProcessingRef.current = isProcessing;
    prevContentRef.current = content;
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, isProcessing, showLoading, stableContent]);

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
