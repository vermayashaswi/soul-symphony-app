
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
  language?: string;
}

export function TranslatedContent({ content, isExpanded, language }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>(content || '');
  const [isLoading, setIsLoading] = useState(false);
  const { currentLanguage, translate } = useTranslation();

  useEffect(() => {
    async function translateContent() {
      // Immediately set content to ensure something is always displayed
      if (content && content.trim() !== '') {
        setTranslatedContent(content);
      }
      
      // Don't proceed with translation if no content or already in English
      if (!content || content.trim() === '' || currentLanguage === 'en') {
        setIsLoading(false);
        return;
      }
      
      // Now attempt translation while keeping original content visible
      setIsLoading(true);
      
      try {
        const translated = await translate(content);
        // Only update if we got a valid translation result
        if (translated && translated.trim() !== '') {
          setTranslatedContent(translated);
        }
      } catch (error) {
        console.error('Translation error:', error);
        // Keep the original content on error - no need to update state
      } finally {
        setIsLoading(false);
      }
    }

    if (content) {
      translateContent();
    }
  }, [content, currentLanguage, translate]);

  // Always render content (original or translated) with a subtle loading indicator if needed
  return (
    <div className={`transition-opacity duration-300 ${isLoading ? "relative" : ""}`}>
      {isExpanded ? (
        <p className="text-xs md:text-sm text-foreground">{translatedContent || content || ''}</p>
      ) : (
        <p className="text-xs md:text-sm text-foreground line-clamp-3">{translatedContent || content || ''}</p>
      )}
      
      {isLoading && (
        <div className="absolute top-0 right-0">
          <div className="h-2 w-2 bg-primary/50 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
}

export default TranslatedContent;
