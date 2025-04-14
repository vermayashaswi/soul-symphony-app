
import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
  onToggleExpanded: () => void;
}

export const EntryContent: React.FC<EntryContentProps> = ({ 
  content, 
  isExpanded, 
  isProcessing = false,
  onToggleExpanded
}) => {
  const displayContent = content || "No content available";
  const isContentTooLong = displayContent.length > 180;
  
  if (isProcessing) {
    return (
      <div className="flex items-center text-muted-foreground py-1">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        <span className="text-sm">Processing content...</span>
      </div>
    );
  }
  
  if (!isExpanded && isContentTooLong) {
    // Truncated version
    return (
      <div>
        <motion.p 
          className="text-sm whitespace-pre-line"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {displayContent.substring(0, 180).trim()}...
          <button 
            className="text-primary font-medium ml-1 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded();
            }}
          >
            Read more
          </button>
        </motion.p>
      </div>
    );
  }
  
  // Full expanded version
  return (
    <div>
      <motion.p 
        className="text-sm whitespace-pre-line"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {displayContent}
        {isContentTooLong && (
          <button 
            className="text-primary font-medium ml-1 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded();
            }}
          >
            Show less
          </button>
        )}
      </motion.p>
    </div>
  );
};
