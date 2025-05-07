
import React, { useEffect, useState } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { TranslatedContent } from './TranslatedContent';
import { JournalEntry } from '@/types/journal';

interface EntryContentProps {
  entry: JournalEntry;
  isExpanded: boolean;
  isProcessing?: boolean;
  entryId: number;
  onOverflowChange?: (hasOverflow: boolean) => void;
}

export function EntryContent({ 
  entry, 
  isExpanded, 
  isProcessing = false,
  entryId,
  onOverflowChange
}: EntryContentProps) {
  const [isLoading, setIsLoading] = useState(isProcessing);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Function to check for long content that might benefit from expand/collapse functionality
  useEffect(() => {
    const checkForLongContent = () => {
      if (!contentRef.current) return;
      
      // Consider content as "long" if it's more than a certain number of characters
      // or has multiple paragraphs
      const isLongContent = entry.content.length > 280 || entry.content.split('\n').length > 2;
      onOverflowChange?.(isLongContent);
    };

    // Wait for any potential content changes to finish before checking
    const timer = setTimeout(checkForLongContent, 100);
    
    return () => clearTimeout(timer);
  }, [entry.content, onOverflowChange]);

  if (isLoading || isProcessing) {
    return <LoadingEntryContent />;
  }

  return (
    <div ref={contentRef} className="w-full">
      <TranslatedContent 
        content={entry.content} 
        isExpanded={isExpanded} 
        entryId={entryId} 
      />
    </div>
  );
}
