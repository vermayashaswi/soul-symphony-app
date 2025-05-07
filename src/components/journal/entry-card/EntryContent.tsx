
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
  const [hasError, setHasError] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Function to check for long content that might benefit from expand/collapse functionality
  useEffect(() => {
    const checkForLongContent = () => {
      if (!contentRef.current) return;
      
      try {
        // Consider content as "long" if it's more than a certain number of characters
        // or has multiple paragraphs
        const contentToCheck = content || "";
        const isLongContent = contentToCheck.length > 280 || contentToCheck.split('\n').length > 2;
        onOverflowChange?.(isLongContent);
      } catch (error) {
        console.error('[EntryContent] Error checking content length:', error);
        setHasError(true);
      }
    };

    // Wait for any potential content changes to finish before checking
    const timer = setTimeout(checkForLongContent, 100);
    
    return () => clearTimeout(timer);
  }, [content, onOverflowChange]);

  // Handle errors and loading
  useEffect(() => {
    setIsLoading(isProcessing);
    
    // Reset error state when content changes
    if (content) {
      setHasError(false);
    }
  }, [content, isProcessing]);

  if (isLoading || isProcessing) {
    return <LoadingEntryContent />;
  }

  if (hasError || !content) {
    // Provide fallback for error state
    return (
      <div className="p-2 text-muted-foreground text-sm">
        Entry content unavailable
      </div>
    );
  }

  return (
    <div ref={contentRef} className="w-full">
      <TranslatedContent 
        content={content} 
        isExpanded={isExpanded} 
        entryId={entryId} 
      />
    </div>
  );
}

export default EntryContent;
