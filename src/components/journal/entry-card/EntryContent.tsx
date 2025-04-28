
import React, { useState } from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LoadingEntryContent } from './LoadingEntryContent';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Languages } from 'lucide-react';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing: boolean;
  entryId?: number;
  translationText?: string;
  translationStatus?: string;
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing,
  entryId,
  translationText,
  translationStatus
}: EntryContentProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  
  const handleTranslate = async () => {
    if (!entryId || !content) return;
    
    try {
      setIsTranslating(true);
      
      console.log(`[EntryContent] Requesting translation for entry ${entryId}`);
      
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: { 
          text: content, 
          entryId,
          targetLanguage: 'hi' // Default to Hindi, could be made dynamic
        }
      });
      
      if (error) {
        console.error('[EntryContent] Translation error:', error);
        toast.error('Failed to translate entry');
        return;
      }
      
      console.log('[EntryContent] Translation response:', data);
      
      if (data.translatedText) {
        toast.success('Translation completed');
        setShowTranslation(true);
        
        // Dispatch an event to notify the system that entry was updated
        window.dispatchEvent(new CustomEvent('journalEntryUpdated', {
          detail: { entryId }
        }));
      }
    } catch (err) {
      console.error('[EntryContent] Translation error:', err);
      toast.error('Translation service error');
    } finally {
      setIsTranslating(false);
    }
  };

  if (isProcessing) {
    return <LoadingEntryContent />;
  }
  
  const displayContent = showTranslation && translationText ? translationText : content;
  const hasTranslation = translationText && translationStatus === 'completed';

  return (
    <div>
      {entryId && (
        <div className="flex justify-end mb-1">
          {isTranslating ? (
            <Button variant="ghost" size="sm" disabled className="h-6 px-2 text-xs">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Translating...
            </Button>
          ) : hasTranslation ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowTranslation(!showTranslation)} 
              className="h-6 px-2 text-xs"
            >
              <Languages className="h-3 w-3 mr-1" />
              {showTranslation ? 'Show Original' : 'Show Translation'}
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleTranslate} 
              className="h-6 px-2 text-xs"
            >
              <Languages className="h-3 w-3 mr-1" />
              Translate
            </Button>
          )}
        </div>
      )}
    
      {isExpanded ? (
        <TranslatableText 
          text={displayContent} 
          as="p" 
          className="text-xs md:text-sm text-foreground" 
        />
      ) : (
        <TranslatableText 
          text={displayContent} 
          as="p" 
          className="text-xs md:text-sm text-foreground line-clamp-3" 
        />
      )}
    </div>
  );
}

export default EntryContent;
