
import React from 'react';
import { motion } from 'framer-motion';
import { LoadingEntryContent } from './LoadingEntryContent';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
  onToggleExpanded?: () => void;
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing = false,
  onToggleExpanded
}: EntryContentProps) {
  const showFullContent = isExpanded || content.length < 150;
  
  if (isProcessing) {
    return <LoadingEntryContent />;
  }
  
  return (
    <div className="entry-content">
      {showFullContent ? (
        <motion.div 
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          className="whitespace-pre-wrap text-sm"
        >
          {content}
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          className="truncated-content whitespace-pre-wrap text-sm"
        >
          {`${content.substring(0, 150)}...`}
          <div className="mt-1">
            <button 
              onClick={onToggleExpanded} 
              className="text-xs text-blue-500 hover:underline"
            >
              Read more
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
