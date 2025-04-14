
import React, { useState, useEffect } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  const [showLoading, setShowLoading] = useState(isProcessing);
  const [stableContent, setStableContent] = useState(content);
  
  // Detect when content is actually available and worth showing
  useEffect(() => {
    const contentIsLoading = isProcessing || 
                         !content || 
                         content === "Processing entry..." || 
                         content.trim() === "" ||
                         content === "Loading...";
                         
    // Only change the loading state after a small delay to prevent flickering
    const timer = setTimeout(() => {
      setShowLoading(contentIsLoading);
      
      // Only update the stable content when we have meaningful content
      if (!contentIsLoading && content) {
        setStableContent(content);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [content, isProcessing]);

  if (showLoading) {
    return <LoadingEntryContent />;
  }

  return isExpanded ? (
    <div>
      <p className="text-xs md:text-sm text-foreground">{stableContent}</p>
    </div>
  ) : (
    <p className="text-xs md:text-sm text-foreground line-clamp-3">{stableContent}</p>
  );
}

export default EntryContent;
