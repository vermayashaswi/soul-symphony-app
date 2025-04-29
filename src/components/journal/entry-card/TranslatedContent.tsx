
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface TranslatedContentProps {
  originalContent: string;
  translatedContent: string;
  language: string;
}

const TranslatedContent: React.FC<TranslatedContentProps> = ({ 
  originalContent, 
  translatedContent, 
  language 
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  
  const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
  const displayLanguage = language ? languageNames.of(language) : 'Unknown';
  
  const displayContent = showOriginal ? originalContent : translatedContent || originalContent;
  
  return (
    <div className="space-y-2">
      <div className="prose-sm prose-slate dark:prose-invert max-w-none">
        {displayContent.split('\n').map((paragraph, i) => (
          <p key={`p-${i}`} className="mb-2">
            {paragraph || '\u00A0'}
          </p>
        ))}
      </div>
      
      {translatedContent && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {showOriginal 
              ? `Original (${displayLanguage})` 
              : `Translated from ${displayLanguage}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowOriginal(!showOriginal)}
          >
            {showOriginal ? 'Show Translation' : 'Show Original'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TranslatedContent;
