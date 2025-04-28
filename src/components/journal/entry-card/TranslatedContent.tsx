
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingEntryContent } from './LoadingEntryContent';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
  language?: string; // Added language as optional prop
}

// Helper function to clean text of language markers
const cleanTextOfMarkers = (input: string): string => {
  if (!input) return '';
  return input.replace(/\[\w+\]\s*/g, '');
};

export function TranslatedContent({ content, isExpanded, language }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { currentLanguage, translate } = useTranslation();

  useEffect(() => {
    async function translateContent() {
      setIsLoading(true);
      try {
        // Always clean the content of language markers first
        const cleanContent = cleanTextOfMarkers(content);
        
        if (currentLanguage === 'en') {
          setTranslatedContent(cleanContent);
        } else {
          const translated = await translate(cleanContent);
          // Clean again just to be sure no markers were introduced
          setTranslatedContent(cleanTextOfMarkers(translated));
        }
      } catch (error) {
        console.error('Translation error:', error);
        // Fallback to original content but still clean it
        setTranslatedContent(cleanTextOfMarkers(content));
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
