
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface PremiumBadgeProps {
  className?: string;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({ className = "" }) => {
  return (
    <Badge 
      variant="secondary" 
      className={`ml-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 text-xs font-semibold ${className}`}
    >
      <Crown className="w-3 h-3 mr-1" />
      <TranslatableText text="Premium" forceTranslate={true} />
    </Badge>
  );
};
