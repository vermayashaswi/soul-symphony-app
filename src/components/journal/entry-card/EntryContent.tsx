
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
      isExpanded
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
    
    // If transitioning from loading to content, delay a bit more for smoother transition
    if (prevProcessingRef.current && !isProcessing && !contentIsLoading) {
      console.log('[EntryContent] Transitioning from processing to content display');
      timeoutRef.current = setTimeout(() => {
        setShowLoading(false);
        if (content) {
          setStableContent(content);
          console.log('[EntryContent] Updated stable content with new content');
        }
      }, 800); // Longer delay when content becomes available for smoother transition
    } 
    // If still loading or just starting to load, delay is shorter
    else {
      timeoutRef.current = setTimeout(() => {
        setShowLoading(contentIsLoading);
        
        // Only update the stable content when we have meaningful content
        if (!contentIsLoading && content) {
          setStableContent(content);
          console.log('[EntryContent] Updated stable content with new content');
        }
      }, contentIsLoading ? 150 : 500);
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
