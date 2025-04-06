
import React from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  if (isProcessing || !content) {
    return <LoadingEntryContent />;
  }

  return isExpanded ? (
    <div>
      <p className="text-xs md:text-sm text-foreground">{content}</p>
    </div>
  ) : (
    <p className="text-xs md:text-sm text-foreground line-clamp-3">{content}</p>
  );
}

export default EntryContent;
