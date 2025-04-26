
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
      
      // Dispatch an event to notify that theme extraction is starting
      // This allows other components to update their UI immediately
      window.dispatchEvent(new CustomEvent('themeExtractionStarted', { 
        detail: { entryId }
      }));
      
      const success = await triggerThemeExtraction(entryId);
      
      if (success) {
        toast.success('Themes extraction triggered');
        
        // Dispatch event for successful theme extraction
        window.dispatchEvent(new CustomEvent('themeExtractionSucceeded', { 
          detail: { entryId }
        }));
        
        // Force an immediate check for themes
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('checkForThemesNow', { 
            detail: { entryId }
          }));
        }, 500);
      } else {
        toast.error('Failed to extract themes');
        
        // Dispatch event for failed theme extraction
        window.dispatchEvent(new CustomEvent('themeExtractionFailed', { 
          detail: { entryId }
        }));
      }
    } catch (error) {
      console.error('Error triggering theme extraction:', error);
      toast.error('Error triggering theme extraction');
      
      // Dispatch event for failed theme extraction with error
      window.dispatchEvent(new CustomEvent('themeExtractionFailed', { 
        detail: { entryId, error }
      }));
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
      <RefreshCw className={`h-4 w-4 mr-2 ${isExtracting ? 'animate-spin' : ''}`} />
      {isExtracting ? 'Extracting...' : 'Refresh Themes'}
    </Button>
  );
}

export default ExtractThemeButton;
