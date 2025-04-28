
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingEntryContent } from './LoadingEntryContent';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
  language?: string; // Added language as optional prop
}

export function TranslatedContent({ content, isExpanded, language }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>(content || '');
  const [isLoading, setIsLoading] = useState(false);
  const { currentLanguage, translate } = useTranslation();

  useEffect(() => {
    async function translateContent() {
      // Only show loading if we have no content to display
      if (!translatedContent) {
        setIsLoading(true);
      }
      
      try {
        if (currentLanguage === 'en') {
          setTranslatedContent(content);
        } else {
          const translated = await translate(content);
          setTranslatedContent(translated);
        }
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedContent(content); // Fallback to original content
      } finally {
        setIsLoading(false);
      }
    }

    if (content) {
      translateContent();
    }
  }, [content, currentLanguage, translate]);

  // Don't show the loading component in place of actual content
  // Just render content with a subtle loading indicator if needed
  return (
    <div className={isLoading ? "opacity-80" : ""}>
      {isExpanded ? (
        <p className="text-xs md:text-sm text-foreground">{translatedContent || content}</p>
      ) : (
        <p className="text-xs md:text-sm text-foreground line-clamp-3">{translatedContent || content}</p>
      )}
    </div>
  );
}

export default TranslatedContent;
