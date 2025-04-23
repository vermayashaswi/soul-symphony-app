
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { triggerThemeExtraction } from '@/utils/audio/theme-extractor';

interface ExtractThemeButtonProps {
  entryId: number;
}

export function ExtractThemeButton({ entryId }: ExtractThemeButtonProps) {
  const [isExtracting, setIsExtracting] = useState(false);

  const handleExtractThemes = async () => {
    try {
      setIsExtracting(true);
      const success = await triggerThemeExtraction(entryId);
      
      if (success) {
        toast.success('Themes extraction triggered');
      } else {
        toast.error('Failed to extract themes');
      }
    } catch (error) {
      console.error('Error triggering theme extraction:', error);
      toast.error('Error triggering theme extraction');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleExtractThemes}
      disabled={isExtracting}
      className="mt-2 w-full bg-background hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      {isExtracting ? 'Extracting...' : 'Refresh Themes'}
    </Button>
  );
}

export default ExtractThemeButton;
