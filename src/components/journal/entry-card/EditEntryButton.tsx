
import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EditEntryButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function EditEntryButton({ onClick, disabled = false }: EditEntryButtonProps) {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground"
    >
      <Pencil size={16} className="mr-2" />
      <TranslatableText text="Edit" />
    </Button>
  );
}

export default EditEntryButton;
