
import React, { useEffect, useState } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Check if content is actually available
  const contentIsLoading = isProcessing || 
                         !content || 
                         content === "Processing entry..." || 
                         content.trim() === "" ||
                         content === "Loading...";
  
  useEffect(() => {
    // Update loading state when content changes
    setIsLoading(contentIsLoading);
  }, [contentIsLoading, content]);

  if (isLoading) {
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
