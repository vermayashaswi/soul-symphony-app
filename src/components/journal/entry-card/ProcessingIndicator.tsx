
import React from 'react';
import { motion } from 'framer-motion';
import { LoadingEntryContent } from './LoadingEntryContent';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ProcessingIndicatorProps {
  shouldShow: boolean;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ shouldShow }) => {
  if (!shouldShow) {
    return null;
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 bg-muted/40 border rounded-lg p-4 shadow-sm"
    >
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium"><TranslatableText text="Processing New Entry" /></h3>
          <div className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
            <TranslatableText text="In Progress" />
          </div>
        </div>
        
        <div className="pt-2 text-sm">
          <LoadingEntryContent />
        </div>
      </div>
    </motion.div>
  );
};
