
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Clock, Sparkles } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { SubscriptionPaywall } from './SubscriptionPaywall';

interface TrialCountdownProps {
  variant?: 'badge' | 'full' | 'compact';
  showUpgradeButton?: boolean;
}

export function TrialCountdown({ variant = 'badge', showUpgradeButton = false }: TrialCountdownProps) {
  const { subscriptionStatus } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    if (subscriptionStatus.isInTrial && subscriptionStatus.trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(subscriptionStatus.trialEndsAt);
      const diffTime = trialEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysLeft(Math.max(0, diffDays));
    }
  }, [subscriptionStatus]);

  // Don't show if not in trial
  if (!subscriptionStatus.isInTrial || daysLeft <= 0) {
    return null;
  }

  if (showPaywall) {
    return (
      <SubscriptionPaywall
        onSuccess={() => setShowPaywall(false)}
        onClose={() => setShowPaywall(false)}
        showTrialOption={false}
      />
    );
  }

  const urgencyColor = daysLeft <= 2 ? 'destructive' : daysLeft <= 5 ? 'warning' : 'default';

  if (variant === 'badge') {
    return (
      <Badge 
        variant={urgencyColor === 'destructive' ? 'destructive' : 'secondary'}
        className={`
          cursor-pointer transition-all hover:scale-105
          ${urgencyColor === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-300' : ''}
        `}
        onClick={() => setShowPaywall(true)}
      >
        <Clock className="h-3 w-3 mr-1" />
        <TranslatableText text={`${daysLeft} days left`} />
      </Badge>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center text-sm">
          <Clock className="h-4 w-4 mr-1 text-amber-600" />
          <span className="font-medium">
            <TranslatableText text={`${daysLeft} days left`} />
          </span>
        </div>
        {showUpgradeButton && (
          <Button size="sm" onClick={() => setShowPaywall(true)}>
            <Crown className="h-3 w-3 mr-1" />
            <TranslatableText text="Upgrade" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-100 rounded-full">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-900">
              <TranslatableText text={`${daysLeft} days left in your trial`} />
            </h4>
            <p className="text-sm text-amber-700">
              <TranslatableText text="Don't lose access to premium features" />
            </p>
          </div>
        </div>
        <Button onClick={() => setShowPaywall(true)} className="bg-gradient-to-r from-purple-600 to-blue-600">
          <Crown className="h-4 w-4 mr-2" />
          <TranslatableText text="Upgrade Now" />
        </Button>
      </div>
    </div>
  );
}
