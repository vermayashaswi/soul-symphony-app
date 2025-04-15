
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
  const prevProcessingRef = useRef(isProcessing);
  const prevContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentAvailableRef = useRef(false);
  
  // Debug logging
  useEffect(() => {
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: !content || content === "Processing entry..." || content.trim() === "" || content === "Loading...",
      stableContentSet: stableContent === content
    });
  }, [content, isProcessing, isExpanded, showLoading, stableContent, addEvent]);
  
  // Handle content and loading state transitions
  useEffect(() => {
    // Immediately show loading state if isProcessing is true, regardless of current state
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
    
    addEvent('EntryContent', 'Content status check', 'info', {
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
      
      addEvent('EntryContent', `Content available, will show after ${delayTime}ms delay`, 'info');
      
      timeoutRef.current = setTimeout(() => {
        addEvent('EntryContent', 'Transitioning from loading to content display', 'info');
        setShowLoading(false);
        setStableContent(content);
      }, delayTime);
    } else if (content !== stableContent && !showLoading) {
      // Content has changed while already displaying content (not during loading)
      addEvent('EntryContent', 'Content updated while already showing content', 'info');
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
  }, [content, isProcessing, showLoading, stableContent, addEvent]);

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
          onAnimationStart={() => addEvent('EntryContent', 'Expanded content animation started', 'info')}
          onAnimationComplete={() => addEvent('EntryContent', 'Expanded content animation completed', 'info')}
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
          onAnimationStart={() => addEvent('EntryContent', 'Collapsed content animation started', 'info')}
          onAnimationComplete={() => addEvent('EntryContent', 'Collapsed content animation completed', 'info')}
        >
          {stableContent}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
