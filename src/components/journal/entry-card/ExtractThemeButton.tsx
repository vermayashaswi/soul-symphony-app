
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SparklesIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

export interface ExtractThemeButtonProps {
  entryId: number;
  onComplete?: (updatedEntry: JournalEntry) => void;
}

const ExtractThemeButton: React.FC<ExtractThemeButtonProps> = ({ entryId, onComplete }) => {
  const { toast } = useToast();
  const [isExtracting, setIsExtracting] = useState(false);

  const handleExtractThemes = async () => {
    if (isExtracting || !entryId) return;
    
    setIsExtracting(true);
    toast({
      title: 'Extracting themes...',
      description: 'This may take a moment.',
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-themes', {
        body: { entryId }
      });
      
      if (error) throw error;
      
      toast({
        title: 'Themes extracted!',
        description: 'Journal entry updated with themes.',
      });
      
      if (onComplete && data.entry) {
        onComplete(data.entry);
      }
      
    } catch (error) {
      console.error('Error extracting themes:', error);
      toast({
        title: 'Theme extraction failed',
        description: 'Something went wrong. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleExtractThemes}
      disabled={isExtracting}
      title="Extract themes from this entry"
    >
      <SparklesIcon className={`h-4 w-4 ${isExtracting ? 'animate-pulse' : ''}`} />
    </Button>
  );
};

export default ExtractThemeButton;
