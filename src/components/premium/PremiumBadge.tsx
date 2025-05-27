
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';

interface PremiumBadgeProps {
  variant?: 'default' | 'trial' | 'premium';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function PremiumBadge({ 
  variant, 
  size = 'md', 
  showIcon = true, 
  className = '' 
}: PremiumBadgeProps) {
  const { subscriptionStatus, daysUntilTrialExpires } = useSubscription();

  // Determine variant automatically if not specified
  const actualVariant = variant || (
    subscriptionStatus.isTrialActive ? 'trial' : 
    subscriptionStatus.isActive ? 'premium' : 
    'default'
  );

  const getBadgeContent = () => {
    switch (actualVariant) {
      case 'trial':
        return {
          text: daysUntilTrialExpires && daysUntilTrialExpires > 0 
            ? `Trial: ${daysUntilTrialExpires}d left`
            : 'Trial Active',
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        };
      case 'premium':
        return {
          text: 'Premium',
          className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
        };
      default:
        return {
          text: 'Free',
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
        };
    }
  };

  const { text, className: badgeClassName } = getBadgeContent();

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1.5',
    lg: 'text-base px-3 py-2'
  };

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <Badge 
      className={`${badgeClassName} ${sizeClasses[size]} ${className} flex items-center gap-1`}
    >
      {showIcon && <Star className={iconSize[size]} />}
      {text}
    </Badge>
  );
}
