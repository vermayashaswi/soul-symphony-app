
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, Clock, User } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { cn } from '@/lib/utils';

interface SubscriptionBadgeProps {
  isPremium: boolean;
  isTrialActive: boolean;
  subscriptionStatus: string | null;
  isLoading?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

export const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ 
  isPremium, 
  isTrialActive, 
  subscriptionStatus,
  isLoading = false,
  className = "",
  size = "default"
}) => {
  if (isLoading) {
    return (
      <Badge 
        variant="secondary" 
        size={size}
        className={cn("ml-2 animate-pulse", className)}
      >
        <div className="w-12 h-3 bg-muted-foreground/20 rounded" />
      </Badge>
    );
  }

  if (isPremium && isTrialActive) {
    return (
      <Badge 
        variant="secondary" 
        size={size}
        className={cn("ml-2 bg-gradient-to-r from-blue-400 to-blue-600 text-white border-0 font-semibold", className)}
      >
        <Clock className={cn("mr-1", size === 'sm' ? "w-3 h-3" : "w-4 h-4")} />
        <TranslatableText text="Trial" forceTranslate={true} />
      </Badge>
    );
  }

  if (isPremium) {
    return (
      <Badge 
        variant="secondary" 
        size={size}
        className={cn("ml-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 font-semibold", className)}
      >
        <Crown className={cn("mr-1", size === 'sm' ? "w-3 h-3" : "w-4 h-4")} />
        <TranslatableText text="Premium" forceTranslate={true} />
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      size={size}
      className={cn("ml-2 text-muted-foreground border-muted-foreground/30", className)}
    >
      <User className={cn("mr-1", size === 'sm' ? "w-3 h-3" : "w-4 h-4")} />
      <TranslatableText text="Free" forceTranslate={true} />
    </Badge>
  );
};
