
import React, { useState, useEffect, useRef } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { AnimatePresence, motion } from 'framer-motion';
import { useDebugLog } from '@/utils/debug/DebugContext';
import TranslatedContent from './TranslatedContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
  language?: string;
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing = false,
  language = 'en'
}: EntryContentProps) {
  const { addEvent } = useDebugLog();
  const [showLoading, setShowLoading] = useState(isProcessing);
  const [stableContent, setStableContent] = useState(content);
  const [forceLoading, setForceLoading] = useState(false);
  const mountedRef = useRef(true);
  const contentReadyDispatchedRef = useRef(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add safety timeout to exit loading state if it gets stuck
  useEffect(() => {
    // Always set up a safety timeout to ensure loading state doesn't get stuck
    if (showLoading || forceLoading) {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      
      safetyTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          console.log('[EntryContent] Safety timeout triggered - forcing content display');
          setShowLoading(false);
          setForceLoading(false);
          
          if (content) {
            setStableContent(content);
          }
        }
      }, 5000); // 5 seconds safety timeout
    }
    
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [showLoading, forceLoading, content]);

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

    // Modified: Be less strict about showing loading - prioritize showing content
    // Only show loading if we absolutely have no content at all to display
    const contentIsEmpty = !content || content.trim() === "";
    const isProcessingPlaceholder = content === "Processing entry..." || content === "Loading...";
    
    // If we have real content, show it even if it's technically still processing
    if (!contentIsEmpty && !isProcessingPlaceholder) {
      setShowLoading(false);
      setStableContent(content);
      
      if (!contentReadyDispatchedRef.current) {
        contentReadyDispatchedRef.current = true;
        
        window.dispatchEvent(new CustomEvent('entryContentReady', { 
          detail: { 
            content,
            timestamp: Date.now(),
            readyForDisplay: true,
            forceRemoveProcessing: true
          }
        }));
        
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            content,
            timestamp: Date.now(),
            forceCleanup: true,
            immediate: true
          }
        }));
        
        window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
          detail: {
            timestamp: Date.now(),
            forceClearProcessingCard: true,
            immediate: true
          }
        }));
      }
    } else if ((contentIsEmpty || isProcessingPlaceholder) && !forceLoading) {
      setShowLoading(true);
      contentReadyDispatchedRef.current = false;
    }
    
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: contentIsEmpty || isProcessingPlaceholder,
      forceLoading,
      contentReady: contentReadyDispatchedRef.current
    });
    
  }, [content, isProcessing, addEvent, forceLoading]);
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(showLoading || forceLoading) ? (
        <LoadingEntryContent key="loading" />
      ) : (
        <TranslatedContent 
          content={stableContent}
          isExpanded={isExpanded}
          language={language}
        />
      )}
    </AnimatePresence>
  );
}

export default EntryContent;
