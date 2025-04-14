
import React from 'react';
import { motion } from 'framer-motion';
import { LoadingEntryContent } from './LoadingEntryContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing = false 
}: EntryContentProps) {
  const showFullContent = isExpanded || content.length < 150;
  
  if (isProcessing) {
    return <LoadingEntryContent />;
  }
  
  return (
    <>
      {showFullContent ? (
        <motion.div 
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          className="entry-content whitespace-pre-wrap"
        >
          {content}
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          className="entry-content truncated-content whitespace-pre-wrap"
        >
          {`${content.substring(0, 150)}...`}
        </motion.div>
      )}
    </>
  );
}

