
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Higher-order component that injects translation capabilities
 * into a component
 */
export function withTranslation<P extends object>(
  Component: React.ComponentType<P & { translate: (key: string, fallback?: string) => string }>
): React.FC<P> {
  return (props: P) => {
    const { translate } = useLanguage();
    return <Component {...props} translate={translate} />;
  };
}

/**
 * Hook for translating dynamic content in components
 */
export const useTranslatedContent = () => {
  const { language, translate } = useLanguage();
  
  // Helper function to translate dynamic content
  const translateDynamic = (contentMap: Record<string, string>) => {
    // Try to get content for current language
    if (contentMap[language]) {
      return contentMap[language];
    }
    
    // Fall back to English
    if (language !== 'en' && contentMap['en']) {
      return contentMap['en'];
    }
    
    // If all else fails, return first available content
    const firstContent = Object.values(contentMap)[0];
    return firstContent || '';
  };
  
  return {
    translate,
    translateDynamic,
    currentLanguage: language
  };
};
