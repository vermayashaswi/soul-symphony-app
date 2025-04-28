
import React from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { TranslatedContent } from './TranslatedContent';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
}

export function EntryContent({ content, isExpanded, isProcessing = false }: EntryContentProps) {
  // More strict condition for showing loading state:
  // Only show loading if explicitly in processing mode AND content is truly empty or contains placeholder text
  const isEmptyContent = !content || content.trim() === "";
  const isPlaceholderContent = content === "Processing entry..." || content === "Loading...";
  
  // Only show loading when both processing flag is true AND we don't have real content
  const showLoading = isProcessing && (isEmptyContent || isPlaceholderContent);
  
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
