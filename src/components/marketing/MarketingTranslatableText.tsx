
import React from 'react';
import { useMarketingTranslation } from '@/contexts/MarketingTranslationContext';

interface MarketingTranslatableTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function MarketingTranslatableText({ 
  text, 
  className = "",
  as: Component = 'span'
}: MarketingTranslatableTextProps) {
  const { currentLanguage } = useMarketingTranslation();

  // For now, just display the original text
  // In the future, this could integrate with a simpler translation service
  console.log(`[MarketingTranslatableText] Displaying text in ${currentLanguage}:`, text);

  return React.createElement(
    Component, 
    { 
      className,
      'data-lang': currentLanguage,
      'data-marketing-text': 'true'
    }, 
    text
  );
}

export default MarketingTranslatableText;
