
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ThemeBoxesProps {
  themes: string[];
  entryId?: number;
  sourceLanguage?: string;
}

export function ThemeBoxes({ themes = [], entryId, sourceLanguage }: ThemeBoxesProps) {
  // Ensure we have valid themes
  const validThemes = themes
    .filter(theme => theme && typeof theme === 'string' && theme.trim() !== '')
    .slice(0, 8); // Limit to 8 themes for UI cleanliness
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {validThemes.map((theme, index) => (
        <Badge 
          key={`${theme}-${index}`}
          variant="secondary"
          className="text-xs font-normal bg-primary/10 text-primary-foreground"
        >
          <TranslatableText 
            text={theme} 
            sourceLanguage={sourceLanguage}
            entryId={entryId}
          />
        </Badge>
      ))}
    </div>
  );
}

export default ThemeBoxes;
