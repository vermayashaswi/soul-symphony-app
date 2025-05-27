
import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Crown, X } from 'lucide-react';
import { useUsageLimits } from '@/hooks/use-usage-limits';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { SubscriptionPaywall } from './SubscriptionPaywall';

interface UsageLimitNotificationProps {
  type: 'journalEntries' | 'chatMessages';
  onDismiss?: () => void;
}

export function UsageLimitNotification({ type, onDismiss }: UsageLimitNotificationProps) {
  const { usage, isApproachingLimit, hasReachedLimit } = useUsageLimits();
  const [showPaywall, setShowPaywall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const currentUsage = usage[type];
  const shouldShow = (isApproachingLimit(type) || hasReachedLimit(type)) && !dismissed;

  if (!shouldShow) return null;

  if (showPaywall) {
    return (
      <SubscriptionPaywall
        onSuccess={() => setShowPaywall(false)}
        onClose={() => setShowPaywall(false)}
        showTrialOption={true}
      />
    );
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const featureName = type === 'journalEntries' ? 'Journal Entries' : 'Chat Messages';
  const isAtLimit = hasReachedLimit(type);

  return (
    <Alert className={`mb-4 ${isAtLimit ? 'border-destructive' : 'border-amber-400'}`}>
      <AlertTriangle className={`h-4 w-4 ${isAtLimit ? 'text-destructive' : 'text-amber-600'}`} />
      <AlertDescription className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-semibold mb-1">
              {isAtLimit ? (
                <TranslatableText text={`${featureName} Limit Reached`} />
              ) : (
                <TranslatableText text={`Approaching ${featureName} Limit`} />
              )}
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              {isAtLimit ? (
                <TranslatableText text={`You've used all ${currentUsage.limit} ${type === 'journalEntries' ? 'journal entries' : 'chat messages'} in your free plan.`} />
              ) : (
                <TranslatableText text={`You've used ${currentUsage.current} of ${currentUsage.limit} ${type === 'journalEntries' ? 'journal entries' : 'chat messages'}.`} />
              )}
            </p>
            <Progress value={currentUsage.percentage} className="h-2 mb-3" />
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={() => setShowPaywall(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600"
              >
                <Crown className="h-3 w-3 mr-1" />
                <TranslatableText text="Upgrade to Premium" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleDismiss}>
                <TranslatableText text="Dismiss" />
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
