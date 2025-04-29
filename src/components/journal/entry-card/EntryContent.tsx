
import React from 'react';

export interface EntryContentProps {
  content: string;
  entryId: number;
}

export const EntryContent: React.FC<EntryContentProps> = ({ content, entryId }) => {
  return (
    <div className="prose-sm prose-slate dark:prose-invert max-w-none">
      {content.split('\n').map((paragraph, i) => (
        <p key={`${entryId}-p-${i}`} className="mb-2">
          {paragraph || '\u00A0'}
        </p>
      ))}
    </div>
  );
};

export default EntryContent;
