import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Gift } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface FreeTrialBadgeProps {
  className?: string;
  style?: React.CSSProperties;
}

export const FreeTrialBadge: React.FC<FreeTrialBadgeProps> = ({ className = "", style }) => {
  return (
    <Badge 
      variant="secondary" 
      className={`ml-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 text-xs font-semibold shadow-sm ${className}`}
      style={style}
    >
      <Gift className="w-3 h-3 mr-1" />
      <TranslatableText text="First 2 weeks free. No credit Card" forceTranslate={true} />
    </Badge>
  );
};