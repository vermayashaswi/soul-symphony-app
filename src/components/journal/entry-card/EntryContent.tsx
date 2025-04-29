
import React, { useEffect, useRef, useState } from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LoadingEntryContent } from './LoadingEntryContent';
import { textWillOverflow } from '@/utils/textUtils';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing: boolean;
  entryId?: number;
  onOverflowChange?: (hasOverflow: boolean) => void;
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing,
  onOverflowChange
}: EntryContentProps) {
  const contentRef = useRef<HTMLParagraphElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  
  // Check for content overflow on initial render and on content changes
  useEffect(() => {
    // Use our utility for initial check
    const overflowEstimate = textWillOverflow(content);
    setHasOverflow(overflowEstimate);
    
    if (onOverflowChange) {
      onOverflowChange(overflowEstimate);
    }
    
    // For more accurate measurement, check after render if we have DOM access
    if (contentRef.current && !isExpanded) {
      const element = contentRef.current;
      const hasActualOverflow = element.scrollHeight > element.clientHeight;
      
      if (hasActualOverflow !== hasOverflow) {
        setHasOverflow(hasActualOverflow);
        if (onOverflowChange) {
          onOverflowChange(hasActualOverflow);
        }
      }
    }
  }, [content, isExpanded, onOverflowChange]);

  if (isProcessing) {
    return <LoadingEntryContent />;
  }

  return (
    <div>
      {isExpanded ? (
        <TranslatableText 
          text={content} 
          as="p" 
          className="text-xs md:text-sm text-foreground" 
          ref={contentRef}
        />
      ) : (
        <TranslatableText 
          text={content} 
          as="p" 
          className="text-xs md:text-sm text-foreground line-clamp-3" 
          ref={contentRef}
        />
      )}
    </div>
  );
}

export default EntryContent;
