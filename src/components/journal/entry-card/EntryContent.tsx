
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
  const transitionInProgressRef = useRef(false);
  const mountedRef = useRef(false);
  
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
  
  // Mark component as mounted
  useEffect(() => {
    mountedRef.current = true;
    
    // On mount, check if we need to restore the loading state from session storage
    const storedLoadingState = 
      sessionStorage.getItem('entryContentLoading') === 'true' || 
      localStorage.getItem('entryContentLoading') === 'true';
      
    if (storedLoadingState && !showLoading) {
      addEvent('EntryContent', 'Restoring loading state from storage on mount', 'info');
      setShowLoading(true);
      transitionInProgressRef.current = true;
    }
    
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Handle content and loading state transitions with persistence
  useEffect(() => {
    // Force loading state to show if isProcessing is true
    if (isProcessing && !showLoading) {
      addEvent('EntryContent', 'Processing started, showing loading state immediately', 'info');
      setShowLoading(true);
      transitionInProgressRef.current = true;
      
      // Store state in both localStorage and sessionStorage for maximum persistence
      try {
        sessionStorage.setItem('entryContentLoading', 'true');
        localStorage.setItem('entryContentLoading', 'true');
      } catch (error) {
        console.error('Error storing loading state in storage:', error);
      }
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
      transitionInProgress: transitionInProgressRef.current
    });
    
    // Clear any existing timeout to prevent race conditions
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (contentIsLoading) {
      // Show loading state
      setShowLoading(true);
      contentAvailableRef.current = false;
      transitionInProgressRef.current = true;
      
      // Store the loading state in both localStorage and sessionStorage for maximum persistence
      try {
        sessionStorage.setItem('entryContentLoading', 'true');
        localStorage.setItem('entryContentLoading', 'true');
      } catch (error) {
        console.error('Error storing loading state in storage:', error);
      }
    } else if (!contentAvailableRef.current) {
      // Content is now available - transition from loading to content display
      contentAvailableRef.current = true;
      
      // Keep loading state visible for a moment for better UX
      const delayTime = prevProcessingRef.current && !isProcessing ? 2000 : 1000;
      
      addEvent('EntryContent', `Content available, will show after ${delayTime}ms delay`, 'info');
      
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        addEvent('EntryContent', 'Transitioning from loading to content display', 'info');
        setShowLoading(false);
        setStableContent(content);
        
        // Clear the loading state in both localStorage and sessionStorage
        try {
          sessionStorage.removeItem('entryContentLoading');
          localStorage.removeItem('entryContentLoading');
        } catch (error) {
          console.error('Error removing loading state from storage:', error);
        }
        
        timeoutRef.current = setTimeout(() => {
          transitionInProgressRef.current = false;
        }, 300); // Allow time for the animation to complete
      }, delayTime);
    } else if (content !== stableContent && !showLoading && !transitionInProgressRef.current) {
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
  
  // Handle visibility changes - critical for navigation between app features
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When app becomes visible again, check if we need to restore loading state
        try {
          const storedLoadingState = 
            sessionStorage.getItem('entryContentLoading') === 'true' || 
            localStorage.getItem('entryContentLoading') === 'true';
            
          if (storedLoadingState && !showLoading) {
            addEvent('EntryContent', 'Restoring loading state from storage on visibility change', 'info');
            setShowLoading(true);
            transitionInProgressRef.current = true;
          }
        } catch (error) {
          console.error('Error checking loading state in storage:', error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showLoading, addEvent]);
  
  // React to processing entries changes from other components
  useEffect(() => {
    const handleProcessingEntriesChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.restoredFromNavigation) {
        addEvent('EntryContent', 'Processing entries restored from navigation', 'info');
        
        if (!showLoading) {
          setShowLoading(true);
          transitionInProgressRef.current = true;
          
          // Also store in storage for persistence
          try {
            sessionStorage.setItem('entryContentLoading', 'true');
            localStorage.setItem('entryContentLoading', 'true');
          } catch (error) {
            console.error('Error storing loading state in storage:', error);
          }
        }
      }
    };
    
    window.addEventListener('processingEntriesChanged', handleProcessingEntriesChanged);
    
    return () => {
      window.removeEventListener('processingEntriesChanged', handleProcessingEntriesChanged);
    };
  }, [showLoading, addEvent]);

  // This is critical for iOS - we need to use a non-default exit mode to avoid animation artifacts
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
          className="will-change-opacity" // iOS optimization
        >
          <p className="text-xs md:text-sm text-foreground">{stableContent}</p>
        </motion.div>
      ) : (
        <motion.p
          key="collapsed" 
          className="text-xs md:text-sm text-foreground line-clamp-3 will-change-opacity" // iOS optimization
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
