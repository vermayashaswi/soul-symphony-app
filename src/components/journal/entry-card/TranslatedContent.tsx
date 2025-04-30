
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingEntryContent } from './LoadingEntryContent';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
  language?: string; // The detected language of the content
  entryId?: number; // Added entryId parameter
}

export function TranslatedContent({ content, isExpanded, language, entryId }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { currentLanguage, translate } = useTranslation();

  // Function to handle translation
  const handleTranslation = async () => {
    if (!content) return;
    
    setIsLoading(true);
    try {
      if (currentLanguage === 'en') {
        setTranslatedContent(content);
      } else {
        // Always set original content first to ensure something is displayed
        setTranslatedContent(content);
        
        // Then translate
        const translated = await translate(content, language, entryId);
        if (translated) {
          setTranslatedContent(translated);
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
  }, [content, currentLanguage, language, entryId]);

  // Listen for language change events
  useEffect(() => {
    const handleLanguageChange = () => {
      console.log('TranslatedContent: Language change event detected');
      // First reset to original content to ensure visibility
      setTranslatedContent(content);
      // Then retranslate
      handleTranslation();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [content, language, entryId]);

  return (
    <div>
      {isExpanded ? (
        <div className="relative">
          <p className="text-xs md:text-sm text-foreground">{translatedContent || content}</p>
          {isLoading && <div className="absolute top-0 right-0 w-2 h-2 bg-primary/50 rounded-full animate-pulse"></div>}
        </div>
      ) : (
        <div className="relative">
          <p className="text-xs md:text-sm text-foreground line-clamp-3">{translatedContent || content}</p>
          {isLoading && <div className="absolute top-0 right-0 w-2 h-2 bg-primary/50 rounded-full animate-pulse"></div>}
        </div>
      )}
    </div>
  );
}

export default TranslatedContent;
