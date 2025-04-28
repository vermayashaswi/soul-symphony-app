
import React from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { TranslatedContent } from './TranslatedContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  // Only show loading if explicitly processing and content is empty/loading
  const showLoading = isProcessing && (!content || 
    content === "Processing entry..." || 
    content === "Loading..." ||
    content.trim() === "");
  
  if (showLoading) {
    return <LoadingEntryContent />;
  }

  return (
    <TranslatedContent 
      content={content} 
      isExpanded={isExpanded} 
    />
  );
}
