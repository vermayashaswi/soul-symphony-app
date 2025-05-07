
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ExtractThemeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  processing?: boolean;
}

export function ExtractThemeButton({ 
  onClick, 
  disabled = false,
  processing = false
}: ExtractThemeButtonProps) {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      disabled={disabled || processing}
      className="text-muted-foreground hover:text-foreground"
    >
      <Tag size={16} className="mr-2" />
      <TranslatableText text={processing ? "Extracting..." : "Extract Themes"} />
    </Button>
  );
}

export default ExtractThemeButton;
