
import { useState, useEffect } from 'react';
import { useLanguage, LanguageCode } from '@/contexts/LanguageContext';

/**
 * Hook for using translated content that might be dynamically generated
 * 
 * @param contentGetter Function that returns the content for a given language
 * @param deps Dependencies array for when to refresh translations
 */
export function useTranslatedContent<T>(
  contentGetter: (language: LanguageCode) => Promise<T> | T,
  deps: any[] = []
): { content: T | null; isLoading: boolean; error: Error | null } {
  const { language } = useLanguage();
  const [content, setContent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    
    const fetchContent = async () => {
      try {
        const result = await contentGetter(language);
        if (isMounted) {
          setContent(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching translated content:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchContent();

    return () => {
      isMounted = false;
    };
  }, [language, ...deps]);

  return { content, isLoading, error };
}
