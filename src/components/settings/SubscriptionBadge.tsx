
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
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-0.5';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  if (isLoading) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("ml-2 animate-pulse", sizeClasses, className)}
      >
        <div className="w-12 h-3 bg-muted-foreground/20 rounded" />
      </Badge>
    );
  }

  if (isPremium && isTrialActive) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("ml-2 bg-gradient-to-r from-blue-400 to-blue-600 text-white border-0 font-semibold", sizeClasses, className)}
      >
        <Clock className={cn("mr-1", iconSize)} />
        <TranslatableText text="Trial" forceTranslate={true} />
      </Badge>
    );
  }

  if (isPremium) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("ml-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 font-semibold", sizeClasses, className)}
      >
        <Crown className={cn("mr-1", iconSize)} />
        <TranslatableText text="Premium" forceTranslate={true} />
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn("ml-2 text-muted-foreground border-muted-foreground/30", sizeClasses, className)}
    >
      <User className={cn("mr-1", iconSize)} />
      <TranslatableText text="Free" forceTranslate={true} />
    </Badge>
  );
};
