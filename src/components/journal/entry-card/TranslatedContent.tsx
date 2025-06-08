import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingEntryContent } from './LoadingEntryContent';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
  language?: string; // We'll keep this parameter but ignore it for translation source
  entryId?: number;
}

export function TranslatedContent({ content, isExpanded, language, entryId }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { currentLanguage, translate } = useTranslation();

  // Helper function to clean translation results
  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    
    // Remove language code suffix like "(hi)" or "[hi]" that might be appended
    const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
    return result.replace(languageCodeRegex, '').trim();
  };

  // Function to handle translation
  const handleTranslation = async () => {
    setIsLoading(true);
    try {
      if (currentLanguage === 'en') {
        setTranslatedContent(content);
      } else {
        // Always keep the original content initially
        setTranslatedContent(content);
        
        // IMPORTANT: Always translate from English regardless of the detected language
        // This is the key change - we always assume the refined text is in English
        const translated = await translate(content, "en");
        
        if (translated) {
          // Clean the translation result before setting it
          const cleanedResult = cleanTranslationResult(translated);
          setTranslatedContent(cleanedResult || content);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      setTranslatedContent(content); // Fallback to original content
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to translate content when it changes or language changes
  useEffect(() => {
    handleTranslation();
  }, [content, currentLanguage, entryId]);

  // Listen for language change events
  useEffect(() => {
    const handleLanguageChange = () => {
      // First set to original content to ensure visibility
      setTranslatedContent(content);
      // Then retranslate
      handleTranslation();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [content, entryId]);

  return (
    <div>
      {isExpanded ? (
        <div className="relative">
          <p className="text-xs md:text-sm text-foreground">{translatedContent || content}</p>
          {isLoading && <div className="absolute top-0 right-0 w-2 h-2 bg-primary/50 rounded-full animate-pulse"></div>}
        </div>
      ) : (
        <div className="relative">
          <p className="text-xs md:text-sm text-foreground">{translatedContent || content}</p>
          {isLoading && <div className="absolute top-0 right-0 w-2 h-2 bg-primary/50 rounded-full animate-pulse"></div>}
        </div>
      )}
    </div>
  );
}

export default TranslatedContent;
