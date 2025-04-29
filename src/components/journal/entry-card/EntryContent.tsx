
import React from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LoadingEntryContent } from './LoadingEntryContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing: boolean;
  entryId?: number;
  translationText?: string;
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing
}: EntryContentProps) {
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
        />
      ) : (
        <TranslatableText 
          text={content} 
          as="p" 
          className="text-xs md:text-sm text-foreground line-clamp-3" 
        />
      )}
    </div>
  );
}

export default EntryContent;
