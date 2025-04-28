
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

    const contentIsLoading = content === "Processing entry..." || 
                         content === "Loading...";

    if (contentIsLoading || isProcessing) {
      setShowLoading(true);
      contentReadyDispatchedRef.current = false;
    } else if (!forceLoading) {
      setShowLoading(false);
      setStableContent(content);
      
      if (!contentReadyDispatchedRef.current) {
        contentReadyDispatchedRef.current = true;
        
        // Dispatch events when content is ready
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
    
  }, [content, isProcessing, addEvent, forceLoading]);
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
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
