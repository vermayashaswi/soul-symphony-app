
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, Clock, CheckCircle } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

export const SubscriptionStatus: React.FC = () => {
  const { subscription, isPremium, isTrialActive, trialDaysRemaining, isLoading } = useSubscription();

  if (isLoading || !subscription) {
    return null;
  }

  if (isTrialActive) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Trial: {trialDaysRemaining} days left
      </Badge>
    );
  }

  if (isPremium) {
    return (
      <Badge className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500">
        <Crown className="h-3 w-3" />
        Premium
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      Free
    </Badge>
  );
};
