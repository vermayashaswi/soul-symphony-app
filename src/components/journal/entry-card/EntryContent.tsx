
import React from 'react';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
}

export function EntryContent({ content, isExpanded }: EntryContentProps) {
  if (!content) {
    return <p className="text-xs md:text-sm text-foreground italic">Processing entry content...</p>;
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
