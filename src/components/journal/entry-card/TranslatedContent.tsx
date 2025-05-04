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
      // Only translate if the UI language is different from the content language
      // If content language is unknown, use English as a fallback assumption
      const sourceLanguage = language || "en";
      
      // If the UI language matches the content language, don't translate
      if (currentLanguage === sourceLanguage) {
        setTranslatedContent(content);
      } else {
        // Initially keep the original content
        setTranslatedContent(content);
        // Translate from the source language to the UI language
        const translated = await translate(content, sourceLanguage, entryId);
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
  }, [content, currentLanguage, language, entryId]);

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
          <p className="text-xs md:text-sm text-foreground">{translatedContent || content}</p>
          {isLoading && <div className="absolute top-0 right-0 w-2 h-2 bg-primary/50 rounded-full animate-pulse"></div>}
        </div>
      )}
    </div>
  );
}

export default TranslatedContent;
