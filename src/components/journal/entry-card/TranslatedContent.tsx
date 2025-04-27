
import React, { useState, useEffect } from 'react';
import { TranslationService } from '@/services/translationService';
import { LoadingEntryContent } from './LoadingEntryContent';

interface TranslatedContentProps {
  content: string;
  language: string;
  isExpanded: boolean;
}

export function TranslatedContent({ content, language, isExpanded }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function translateContent() {
      setIsLoading(true);
      try {
        const translated = await TranslationService.translateText({
          text: content,
          targetLanguage: language,
        });
        setTranslatedContent(translated);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedContent(content); // Fallback to original content
      } finally {
        setIsLoading(false);
      }
    }

    if (language !== 'en') {
      translateContent();
    } else {
      setTranslatedContent(content);
      setIsLoading(false);
    }
  }, [content, language]);

  if (isLoading) {
    return <LoadingEntryContent />;
  }

  return (
    <div>
      {isExpanded ? (
        <p className="text-xs md:text-sm text-foreground">{translatedContent}</p>
      ) : (
        <p className="text-xs md:text-sm text-foreground line-clamp-3">{translatedContent}</p>
      )}
    </div>
  );
}

export default TranslatedContent;
