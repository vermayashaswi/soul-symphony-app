
import React from 'react';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
  entryId: number;
}

export function TranslatedContent({ 
  content, 
  isExpanded, 
  entryId 
}: TranslatedContentProps) {
  return (
    <div className="px-4 py-2 whitespace-pre-wrap text-sm">
      {content}
    </div>
  );
}
