
import React from 'react';
import { formatDate } from '@/utils/textUtils';
import { TranslatedContent } from './TranslatedContent';
import { useTranslation } from '@/contexts/TranslationContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EntryContentProps {
  content: string;
  timestamp: string;
  isExpanded: boolean;
}

export function EntryContent({ content, timestamp, isExpanded }: EntryContentProps) {
  const { currentLanguage } = useTranslation();
  
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {formatDate(timestamp, currentLanguage)}
      </div>
      <TranslatedContent content={content} isExpanded={isExpanded} />
    </div>
  );
}

export default EntryContent;
