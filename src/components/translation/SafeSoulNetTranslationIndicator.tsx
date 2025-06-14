
import React from 'react';
import { Loader2 } from 'lucide-react';

interface SafeSoulNetTranslationIndicatorProps {
  className?: string;
}

export const SafeSoulNetTranslationIndicator: React.FC<SafeSoulNetTranslationIndicatorProps> = ({ 
  className = '' 
}) => {
  // For marketing pages, we don't show translation indicators
  // since they don't use the translation context
  return null;
};

export default SafeSoulNetTranslationIndicator;
