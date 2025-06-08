
import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import { TranslatableText } from './TranslatableText';
import { Loader2 } from 'lucide-react';

interface SoulNetTranslationIndicatorProps {
  className?: string;
}

export const SoulNetTranslationIndicator: React.FC<SoulNetTranslationIndicatorProps> = ({ 
  className = '' 
}) => {
  const { isSoulNetTranslating, currentLanguage } = useTranslation();

  // Only show indicator when actively translating and not English
  if (!isSoulNetTranslating || currentLanguage === 'en') {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <Loader2 className="w-4 h-4 animate-spin" />
      <TranslatableText 
        text="Preparing insights translations..." 
        forceTranslate={true}
        enableFontScaling={true}
        scalingContext="general"
      />
    </div>
  );
};

export default SoulNetTranslationIndicator;
