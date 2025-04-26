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
  
  const [forceLoading, setForceLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (isProcessing) {
      setShowLoading(true);
      setForceLoading(true);
      
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
    } else if (!forceLoading) {
      setShowLoading(false);
      setStableContent(content);
      
      window.dispatchEvent(new CustomEvent('entryContentReady', { 
        detail: { 
          content,
          timestamp: Date.now(),
          contentLength: content.length,
          readyForDisplay: true
        }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { 
          content,
          timestamp: Date.now(),
          forceCleanup: true 
        }
      }));
    }
    
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: contentIsLoading,
      forceLoading
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
