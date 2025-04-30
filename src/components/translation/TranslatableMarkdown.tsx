
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from '@/contexts/TranslationContext';

interface TranslatableMarkdownProps {
  children: string;
  className?: string;
}

export function TranslatableMarkdown({ 
  children, 
  className = ""
}: TranslatableMarkdownProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { translate, currentLanguage } = useTranslation();
  const prevLangRef = useRef<string>(currentLanguage);
  const initialLoadDoneRef = useRef<boolean>(false);
  
  // Function to translate markdown content
  const translateMarkdown = async () => {
    // Skip translation if content is empty
    if (!children?.trim()) {
      setTranslatedContent('');
      return;
    }

    // Only translate if not in English or language has changed
    if (currentLanguage !== 'en') {
      if (!isLoading) {
        setIsLoading(true);
      }
      
      console.log(`TranslatableMarkdown: Translating markdown content to ${currentLanguage}`);

      try {
        const result = await translate(children, "en");
        
        // Only update if the language hasn't changed during translation
        if (prevLangRef.current === currentLanguage) {
          setTranslatedContent(result || children);
          console.log(`TranslatableMarkdown: Successfully translated markdown content`);
        } else {
          console.log('Language changed during translation, discarding result');
        }
      } catch (error) {
        console.error('Markdown translation error:', error);
        if (prevLangRef.current === currentLanguage) {
          setTranslatedContent(children); // Fallback to original
        }
        console.warn(`TranslatableMarkdown: Failed to translate markdown content to ${currentLanguage}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // For English, just use the original content
      setTranslatedContent(children);
    }
  };

  // Effect to handle translation when content or language changes
  useEffect(() => {
    let isMounted = true;

    // Update the ref with current language
    prevLangRef.current = currentLanguage;

    // Set to original content immediately for better UX while translating
    if (!initialLoadDoneRef.current || !translatedContent) {
      setTranslatedContent(children);
    }

    const handleTranslation = async () => {
      if (isMounted) {
        await translateMarkdown();
        if (isMounted) {
          initialLoadDoneRef.current = true;
        }
      }
    };

    handleTranslation();

    return () => {
      isMounted = false;
    };
  }, [children, currentLanguage]);
  
  // Listen to language change events to force re-translate
  useEffect(() => {
    const handleLanguageChange = () => {
      // Update the ref
      prevLangRef.current = currentLanguage;
      
      // If we don't have a translation yet, set to original text during translation
      if (!translatedContent) {
        setTranslatedContent(children);
      }
      
      // Then retranslate
      translateMarkdown();
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, [children, currentLanguage]);

  // Ensure we're passing a string to ReactMarkdown (fix for the TypeScript error)
  const contentToRender = translatedContent || children;
  
  return (
    <div className={`${isLoading ? 'opacity-70' : ''}`} data-translating={isLoading ? 'true' : 'false'}>
      <ReactMarkdown className={className}>
        {contentToRender}
      </ReactMarkdown>
    </div>
  );
}

export default TranslatableMarkdown;
