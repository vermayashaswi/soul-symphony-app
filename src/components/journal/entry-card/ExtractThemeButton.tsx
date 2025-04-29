
import React from 'react';
import { Tag } from 'lucide-react';

export interface ExtractThemeButtonProps {
  entryId: number;
}

export function ExtractThemeButton({ entryId }: ExtractThemeButtonProps) {
  const handleExtractThemes = () => {
    console.log(`Extract themes clicked for entry: ${entryId}`);
    // Add your logic to extract themes here
  };

  return (
    <button 
      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
      onClick={handleExtractThemes}
    >
      <Tag className="h-4 w-4" />
      <span>Extract Themes</span>
    </button>
  );
}

export default ExtractThemeButton;
