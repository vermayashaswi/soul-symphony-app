
import React, { useState } from 'react';
import { JournalEntry } from '@/types/journal';
import { TranslatedContent } from './TranslatedContent';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface EntryContentProps {
  entry: JournalEntry;
  isExpanded: boolean;
  entryId: number;
  className?: string;
}

export function EntryContent({ entry, isExpanded, entryId, className }: EntryContentProps) {
  const [expanded, setExpanded] = useState(isExpanded);
  const content = entry.content || entry["refined text"] || entry["transcription text"] || "";
  const shouldTruncate = content.length > 300;
  
  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const displayContent = shouldTruncate && !expanded 
    ? content.substring(0, 300) + '...' 
    : content;

  return (
    <div className={cn("content-container", className)}>
      <TranslatedContent 
        content={displayContent} 
        isExpanded={expanded}
        entryId={entryId}
      />
      
      {shouldTruncate && (
        <div className="px-4 pb-2">
          <Button 
            variant="ghost"
            size="sm"
            onClick={toggleExpand}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp size={14} />
                <TranslatableText text="Show less" />
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                <TranslatableText text="Read more" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
