
import React, { useEffect, useState } from 'react';
import { LoadingEntryContent } from './LoadingEntryContent';
import { TranslatedContent } from '../entry-card/TranslatedContent';
import { supabase } from '@/integrations/supabase/client';

interface EntryContentProps {
  content: string;
  isExpanded: boolean;
  isProcessing?: boolean;
  entryId: number;
  onOverflowChange?: (hasOverflow: boolean) => void;
}

export function EntryContent({ 
  content, 
  isExpanded, 
  isProcessing = false,
  entryId,
  onOverflowChange
}: EntryContentProps) {
  const [isLoading, setIsLoading] = useState(isProcessing);
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>(undefined);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Function to check if content will overflow container
  useEffect(() => {
    const checkOverflow = () => {
      if (!contentRef.current) return;
      
      const hasOverflow = contentRef.current.scrollHeight > contentRef.current.clientHeight;
      onOverflowChange?.(hasOverflow);
    };

    // Wait for any potential content changes to finish before checking
    const timer = setTimeout(checkOverflow, 100);
    
    return () => clearTimeout(timer);
  }, [content, isExpanded, onOverflowChange]);

  // Check for language information from the entry
  useEffect(() => {
    const fetchEntryLanguageInfo = async () => {
      if (!entryId) return;
      
      try {
        // Check if we have the entry in local storage cache
        const cachedLang = localStorage.getItem(`entry_lang_${entryId}`);
        if (cachedLang) {
          setDetectedLanguage(cachedLang);
          return;
        }
        
        // Otherwise fetch it from Supabase
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('*')  // Select all columns to ensure we get what's available
          .eq('id', entryId)
          .single();
          
        if (!error && data) {
          // Check if translation_text or original_language fields exist
          if (data.original_language) {
            setDetectedLanguage(data.original_language);
            // Cache the result
            localStorage.setItem(`entry_lang_${entryId}`, data.original_language);
          }
        }
      } catch (error) {
        console.error('Error fetching entry language:', error);
      }
    };
    
    fetchEntryLanguageInfo();
  }, [entryId]);

  if (isLoading || isProcessing) {
    return <LoadingEntryContent />;
  }

  return (
    <div ref={contentRef}>
      <TranslatedContent 
        content={content} 
        isExpanded={isExpanded} 
        language={detectedLanguage} 
      />
    </div>
  );
}

export default EntryContent;
