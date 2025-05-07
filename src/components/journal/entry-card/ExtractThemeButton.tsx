
import React from 'react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Sparkles } from 'lucide-react';

interface ExtractThemeButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ExtractThemeButton({ 
  onClick, 
  isLoading = false, 
  disabled = false 
}: ExtractThemeButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs flex items-center gap-1.5"
      onClick={onClick}
      disabled={isLoading || disabled}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>
        {isLoading ? (
          <TranslatableText text="Extracting..." />
        ) : (
          <TranslatableText text="Extract Themes" />
        )}
      </span>
    </Button>
  );
}

export default ExtractThemeButton;
