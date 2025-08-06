
import React, { useEffect, useState } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { TranslatedContent } from '../entry-card/TranslatedContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
  entryId: number;
  onOverflowChange?: (hasOverflow: boolean) => void;
}

export function EntryContent({ 
  content, 
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
      const isLongContent = content.length > 280 || content.split('\n').length > 2;
      onOverflowChange?.(isLongContent);
    };

    // Wait for any potential content changes to finish before checking
    const timer = setTimeout(checkForLongContent, 100);
    
    return () => clearTimeout(timer);
  }, [content, onOverflowChange]);

  if (isLoading || isProcessing) {
    return <LoadingEntryContent />;
  }

  return (
    <div 
      ref={contentRef} 
      className="w-full journal-entry-content" 
      data-content-ready="true"
      data-entry-content="true"
    >
      <TranslatedContent 
        content={content} 
        isExpanded={isExpanded} 
        entryId={entryId} 
      />
    </div>
  );
}

export default EntryContent;
