
import React, { useState, useEffect } from 'react';
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
  const [prevContent, setPrevContent] = useState(content);
  const [isRawTranscription, setIsRawTranscription] = useState(false);
  
  // Track content stability to detect rapid changes
  useEffect(() => {
    if (content !== prevContent) {
      setPrevContent(content);
      
      // If not processing and content changes, log the change
      if (!isProcessing) {
        addEvent('EntryContent', 'Content changed', 'info', {
          oldLength: prevContent?.length || 0,
          newLength: content?.length || 0,
          oldContent: prevContent?.slice(0, 20),
          newContent: content?.slice(0, 20)
        });
      }
    }
  }, [content, prevContent, isProcessing, addEvent]);

  // Detect if content is likely raw transcription by checking for untranslated text patterns
  useEffect(() => {
    // Check patterns that might indicate raw transcription
    const containsNonLatinChars = /[^\x00-\x7F]+/.test(content);
    const containsTranscribingMarkers = content.includes("transcribing") || 
                                       content.includes("Processing entry...") ||
                                       content.includes("मुझे") ||
                                       content.includes("音声") ||
                                       content.includes("записи");
    
    if (containsNonLatinChars || containsTranscribingMarkers) {
      setIsRawTranscription(true);
      setShowLoading(true);
      addEvent('EntryContent', 'Raw transcription detected', 'warning', {
        content: content?.slice(0, 50),
        containsNonLatinChars,
        containsTranscribingMarkers
      });
    } else {
      setIsRawTranscription(false);
    }
  }, [content, addEvent]);

  useEffect(() => {
    // When processing flag is true, always show loading state and preserve stable content
    if (isProcessing || isRawTranscription) {
      setShowLoading(true);
      addEvent('EntryContent', 'Processing started', 'info', {
        currentContent: stableContent?.slice(0, 20),
        newContent: content?.slice(0, 20),
        isRawTranscription
      });
      // Important: Don't update stableContent while processing to prevent flicker
      return;
    }

    const contentIsLoading = !content || 
                          content === "Processing entry..." || 
                          content.trim() === "" ||
                          content === "Loading...";

    if (contentIsLoading) {
      setShowLoading(true);
      addEvent('EntryContent', 'Content loading', 'info', {
        contentEmpty: true
      });
    } else {
      // Delay hiding loader slightly to ensure smooth transition
      const timer = setTimeout(() => {
        setShowLoading(false);
        // Only update stable content once loading is complete
        setStableContent(content);
        
        addEvent('EntryContent', 'Finished loading', 'info', {
          contentLength: content?.length || 0,
          sampleContent: content?.slice(0, 20)
        });
      }, 500); // Increased from 300ms to 500ms for more reliable transition
      
      return () => clearTimeout(timer);
    }
    
    addEvent('EntryContent', 'State update', 'info', {
      contentLength: content?.length || 0,
      isProcessing,
      isExpanded,
      showLoading,
      contentEmpty: contentIsLoading,
      stableContentLength: stableContent?.length || 0,
      isRawTranscription
    });
    
  }, [content, isProcessing, addEvent, stableContent, isRawTranscription]);

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
