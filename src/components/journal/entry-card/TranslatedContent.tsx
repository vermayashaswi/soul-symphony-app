import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

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
      // Don't translate if no content or if we're in English
      if (!content || currentLanguage === 'en') {
        setTranslatedContent(content);
        return;
      }
      
      // Only show loading state if we don't have anything to display yet
      if (!translatedContent) {
        setIsLoading(true);
      }
      
      try {
        // CRITICAL: Always maintain the current content while translating
        // Never set to empty string during translation
        const translated = await translate(content);
        
        // Only update if we get valid content back
        if (translated && translated.trim() !== '') {
          setTranslatedContent(translated);
        }
      } catch (error) {
        console.error('Translation error:', error);
        // Fallback to original content on error
        if (!translatedContent) {
          setTranslatedContent(content);
        }
      } finally {
        setIsLoading(false);
      }
    }

    // Keep current content during translation
    if (content && content !== translatedContent) {
      translateContent();
    } else if (!translatedContent && content) {
      setTranslatedContent(content);
    }
  }, [content, currentLanguage, translate, translatedContent]);

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
