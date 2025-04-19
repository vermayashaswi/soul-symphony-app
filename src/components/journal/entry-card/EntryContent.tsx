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
  const prevProcessingRef = useRef(isProcessing);
  const prevContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentAvailableRef = useRef(false);
  
  // Immediately update stableContent when component mounts
  useEffect(() => {
    if (content && content !== "Processing entry..." && content !== "Loading...") {
      setStableContent(content);
    }
  }, []);
  
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
  
  // Handle content and loading state transitions
  useEffect(() => {
    // Force loading state to show if isProcessing is true
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
      showLoading,
      transitionInProgress
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
      const delayTime = prevProcessingRef.current && !isProcessing ? 1000 : 500;
      
      addEvent('EntryContent', `Content available, will show after ${delayTime}ms delay`, 'info');
      
      timeoutRef.current = setTimeout(() => {
        addEvent('EntryContent', 'Transitioning from loading to content display', 'info');
        setTransitionInProgress(true);
        setShowLoading(false);
        setStableContent(content);
        
        // Mark transition as complete after animation
        setTimeout(() => {
          setTransitionInProgress(false);
        }, 350); // Animation duration + small buffer
        
        timeoutRef.current = null;
      }, delayTime);
    } else if (content !== stableContent && !showLoading && !transitionInProgress) {
      // Critical fix for text switching issue: Only update content if no transition is in progress
      // This ensures we don't switch back and forth between old and new content
      addEvent('EntryContent', 'Content updated while already showing content', 'info');
      setTransitionInProgress(true);
      
      // Use a short delay before updating to ensure stable transition
      timeoutRef.current = setTimeout(() => {
        setStableContent(content);
        
        // Release transition lock after animation completes
        setTimeout(() => {
          setTransitionInProgress(false);
        }, 350); // Match animation duration
        
        timeoutRef.current = null;
      }, 50);
    }
    
    // Update refs for next comparison
    prevProcessingRef.current = isProcessing;
    prevContentRef.current = content;
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, isProcessing, showLoading, stableContent, transitionInProgress, addEvent]);

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
