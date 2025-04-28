
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

export interface ExtractThemeButtonProps {
  entryId: number;
  onExtract: () => Promise<void> | void;
  showThemes: boolean;
  themes?: string[];
  masterThemes?: string[];
}

export function ExtractThemeButton({ 
  entryId, 
  onExtract, 
  showThemes, 
  themes, 
  masterThemes 
}: ExtractThemeButtonProps) {
  const hasThemes = (themes && themes.length > 0) || (masterThemes && masterThemes.length > 0);
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs flex items-center gap-1 hover:bg-muted"
      onClick={onExtract}
    >
      <Tag className="h-3.5 w-3.5" />
      {showThemes ? (
        <TranslatableText text="Hide Themes" />
      ) : (
        <TranslatableText text={hasThemes ? "Show Themes" : "Extract Themes"} />
      )}
    </Button>
  );
}

export default ExtractThemeButton;
