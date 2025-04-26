
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  
  const [forceLoading, setForceLoading] = useState(false);
  const mountedRef = useRef(true);
  const contentReadyDispatchedRef = useRef(false);
  const contentProcessedTimestamp = useRef(0);
  
  // Force cleanup on mount to ensure no stale processing cards
  useEffect(() => {
    // On mount, immediately dispatch cleanup events
    window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
      detail: { 
        timestamp: Date.now(),
        forceCleanup: true,
        source: 'EntryContent-mount'
      }
    }));
    
    return () => {
      mountedRef.current = false;
      
      // On unmount, dispatch cleanup to ensure no orphaned processing cards
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: {
          timestamp: Date.now(),
          forceClearProcessingCard: true,
          source: 'EntryContent-unmount'
        }
      }));
    };
  }, []);

  const dispatchContentReady = useCallback(() => {
    if (contentReadyDispatchedRef.current) return;
    
    contentReadyDispatchedRef.current = true;
    contentProcessedTimestamp.current = Date.now();
    
    // Use a sequence of events with small delays to ensure robustness
    const events = [
      // 1. Signal that content is ready
      { 
        name: 'entryContentReady', 
        detail: { 
          content,
          timestamp: Date.now(),
          contentLength: content.length,
          readyForDisplay: true,
          source: 'EntryContent-dispatchContentReady'
        },
        delay: 0
      },
      
      // 2. Force removal immediately
      {
        name: 'forceRemoveProcessingCard',
        detail: { 
          content,
          timestamp: Date.now() + 1,
          forceCleanup: true,
          source: 'EntryContent-dispatchContentReady' 
        },
        delay: 50
      },
      
      // 3. Signal processing complete
      {
        name: 'processingEntryCompleted',
        detail: {
          timestamp: Date.now() + 2,
          forceClearProcessingCard: true,
          source: 'EntryContent-dispatchContentReady'
        },
        delay: 100
      },
      
      // 4. Final cleanup after a short delay
      {
        name: 'forceRemoveAllProcessingCards',
        detail: {
          timestamp: Date.now() + 3,
          source: 'EntryContent-dispatchContentReady'
        },
        delay: 150
      }
    ];
    
    // Dispatch events in sequence with slight delays to ensure proper ordering
    events.forEach(event => {
      setTimeout(() => {
        if (mountedRef.current) {
          window.dispatchEvent(new CustomEvent(event.name, { detail: event.detail }));
        }
      }, event.delay);
    });
  }, [content]);

  useEffect(() => {
    if (isProcessing) {
      setShowLoading(true);
      setForceLoading(true);
      contentReadyDispatchedRef.current = false;
      
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setForceLoading(false);
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }

    const contentIsLoading = !content || 
                          content === "Processing entry..." || 
                          content.trim() === "" ||
                          content === "Loading...";

    if (contentIsLoading) {
      setShowLoading(true);
      contentReadyDispatchedRef.current = false;
    } else if (!forceLoading) {
      setShowLoading(false);
      setStableContent(content);
      
      // If content is ready, dispatch events
      dispatchContentReady();
    }
    
    // Always dispatch force removal when content changes
    if (!contentIsLoading && !isProcessing) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            timestamp: Date.now(),
            forceCleanup: true,
            source: 'EntryContent-contentChanged' 
          }
        }));
      }, 50);
    }
    
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: contentIsLoading,
      forceLoading,
      contentReady: contentReadyDispatchedRef.current
    });
    
  }, [content, isProcessing, addEvent, forceLoading, dispatchContentReady]);

  // Force cleanup on a timer
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      if (mountedRef.current && !showLoading && !forceLoading && stableContent && 
          stableContent !== "Processing entry..." && stableContent.trim() !== "") {
        
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            timestamp: Date.now(),
            forceCleanup: true,
            source: 'EntryContent-cleanupTimer'
          }
        }));
      }
    }, 3000);
    
    return () => clearInterval(cleanupTimer);
  }, [showLoading, forceLoading, stableContent]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(showLoading || forceLoading) ? (
        <LoadingEntryContent key="loading" />
      ) : isExpanded ? (
        <motion.div
          key="expanded"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-xs md:text-sm text-foreground">{stableContent}</p>
        </motion.div>
      ) : (
        <motion.p
          key="collapsed" 
          className="text-xs md:text-sm text-foreground line-clamp-3"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.7 }}
          transition={{ duration: 0.2 }}
        >
          {stableContent}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
