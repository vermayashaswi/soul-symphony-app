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
    // Always update the state with current content first to ensure we're always showing something
    if (content && content !== translatedContent) {
      setTranslatedContent(content);
    }
    
    async function translateContent() {
      // Don't translate if no content or if we're in English
      if (!content || currentLanguage === 'en') {
        setTranslatedContent(content);
        return;
      }
      
      // Indicate loading but don't change content yet
      setIsLoading(true);
      
      try {
        const translated = await translate(content);
        
        // Only update if we get valid content back
        if (translated && translated.trim() !== '') {
          setTranslatedContent(translated);
        } else {
          // If translation returns empty, keep showing original content
          console.log('Translation returned empty, keeping original content');
        }
      } catch (error) {
        console.error('Translation error:', error);
        // No need to fallback since we already set content initially
      } finally {
        setIsLoading(false);
      }
    }

    // Only attempt translation if we have content and language isn't English
    if (content && currentLanguage !== 'en') {
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
