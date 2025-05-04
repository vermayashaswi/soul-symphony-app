
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingEntryContent } from './LoadingEntryContent';

interface TranslatedContentProps {
  content: string;
  isExpanded: boolean;
  language?: string; // We'll keep this parameter but ignore it for translation source
  entryId?: number;
}

export function TranslatedContent({ content, isExpanded, language, entryId }: TranslatedContentProps) {
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { currentLanguage, translate, getCachedTranslation } = useTranslation();
  const mountedRef = useRef<boolean>(true);
  const translationRetryCount = useRef<number>(0);
  const prevLanguageRef = useRef<string>(currentLanguage);
  const contentRef = useRef<string>(content);

  // Helper function to clean translation results
  const cleanTranslationResult = (result: string): string => {
    if (!result) return '';
    
    // Remove language code suffix like "(hi)" or "[hi]" that might be appended
    const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
    return result.replace(languageCodeRegex, '').trim();
  };

  // Function to handle translation with improved error handling and retries
  const handleTranslation = async () => {
    setIsLoading(true);
    
    // Skip if content is empty
    if (!content?.trim()) {
      setIsLoading(false);
      setTranslatedContent('');
      return;
    }
    
    // Skip if already in English
    if (currentLanguage === 'en') {
      setTranslatedContent(content);
      setIsLoading(false);
      return;
    }
    
    try {
      // Check cache first to prevent flickering
      const cachedResult = getCachedTranslation(content, currentLanguage);
      if (cachedResult) {
        setTranslatedContent(cachedResult);
        setIsLoading(false);
        return;
      }
      
      // Set original content initially while we translate
      if (translatedContent !== content) {
        setTranslatedContent(content);
      }
      
      console.log(`TranslatedContent: Translating content for entry ${entryId}`);
      
      // IMPORTANT: Always translate from English regardless of the detected language
      const translated = await translate(content, "en", entryId);
      
      // Only update if component is still mounted and content/language hasn't changed during translation
      if (
        mountedRef.current && 
        prevLanguageRef.current === currentLanguage &&
        contentRef.current === content
      ) {
        if (translated) {
          // Clean the translation result before setting it
          const cleanedResult = cleanTranslationResult(translated);
          setTranslatedContent(cleanedResult || content);
          console.log(`TranslatedContent: Successfully translated content for entry ${entryId}`);
        } else {
          console.warn(`TranslatedContent: Empty translation result for entry ${entryId}`);
          setTranslatedContent(content); // Fallback to original content
        }
        
        // Reset retry counter on success
        translationRetryCount.current = 0;
      }
    } catch (error) {
      console.error('Translation error:', error);
      
      // Retry translation up to 2 times on failure
      if (translationRetryCount.current < 2 && mountedRef.current) {
        translationRetryCount.current++;
        console.warn(`Translation failed for entry ${entryId}, retrying (${translationRetryCount.current}/2)`);
        
        // Wait a moment before retrying (exponential backoff)
        setTimeout(() => {
          if (mountedRef.current) {
            handleTranslation();
          }
        }, 800 * translationRetryCount.current);
      } else {
        // If retry limit reached, fallback to original content
        if (mountedRef.current) {
          setTranslatedContent(content);
          translationRetryCount.current = 0;
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Set up mounted ref for cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Effect to translate content when it changes or language changes
  useEffect(() => {
    // Update refs with current values
    contentRef.current = content;
    prevLanguageRef.current = currentLanguage;
    
    // Reset retry counter when content or language changes
    translationRetryCount.current = 0;
    
    handleTranslation();
  }, [content, currentLanguage, entryId]);

  // Listen for language change events
  useEffect(() => {
    const handleLanguageChange = () => {
      const updatedLanguage = localStorage.getItem('i18nextLng')?.split('-')[0] || 'en';
      
      // Only retranslate if language actually changed
      if (updatedLanguage !== prevLanguageRef.current) {
        console.log(`TranslatedContent: Language change event detected ${prevLanguageRef.current} -> ${updatedLanguage}`);
        
        // Update ref
        prevLanguageRef.current = updatedLanguage;
        contentRef.current = content;
        
        // Reset retry counter
        translationRetryCount.current = 0;
        
        // Then retranslate
        handleTranslation();
      }
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    document.addEventListener('languageChanged', handleLanguageChange);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
      document.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, [content, entryId]);

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
