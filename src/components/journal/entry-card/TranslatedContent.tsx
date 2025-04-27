
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingEntryContent } from './LoadingEntryContent';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
}

export function TranslatedContent({ content, isExpanded }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { currentLanguage, translate } = useTranslation();

  useEffect(() => {
    async function translateContent() {
      setIsLoading(true);
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

    translateContent();
  }, [content, currentLanguage, translate]);

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
