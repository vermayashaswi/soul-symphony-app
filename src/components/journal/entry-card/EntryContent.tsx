
import React from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  // Show loading state when processing or no content available
  // Added additional check to consider empty or placeholder content as "processing"
  if (isProcessing || !content || content === "Processing entry..." || content.trim() === "") {
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
