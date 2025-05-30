
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crown, Clock, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal';

export const SubscriptionManagement: React.FC = () => {
  console.log('[SubscriptionManagement] Rendering component');
  
  const {
    isPremium,
    isTrialActive,
    trialEndDate,
    daysRemainingInTrial,
    subscriptionStatus,
    isLoading,
    error,
    refreshSubscriptionStatus
  } = useSubscription();

  const [isModalOpen, setIsModalOpen] = useState(false);

  console.log('[SubscriptionManagement] Subscription state:', {
    isPremium,
    isTrialActive,
    subscriptionStatus,
    isLoading,
    error
  });

  const handleRefreshStatus = async () => {
    console.log('[SubscriptionManagement] Refreshing subscription status...');
    try {
      await refreshSubscriptionStatus();
      toast.success(<TranslatableText text="Subscription status refreshed" forceTranslate={true} />);
    } catch (error) {
      console.error('[SubscriptionManagement] Failed to refresh status:', error);
      toast.error(<TranslatableText text="Failed to refresh status" forceTranslate={true} />);
    }
  };

  const handleUpgradeClick = () => {
    console.log('[SubscriptionManagement] Opening subscription modal');
    setIsModalOpen(true);
  };

  const formatTrialEndDate = (date: Date | null) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  if (isLoading) {
    console.log('[SubscriptionManagement] Showing loading state');
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-theme-color flex items-center gap-2">
              {isPremium ? (
                <Crown className="h-5 w-5" />
              ) : (
                <Calendar className="h-5 w-5" />
              )}
              <TranslatableText text="Subscription" />
            </h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefreshStatus}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              <TranslatableText text="Refresh" />
            </Button>
          </div>

          {error && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <TranslatableText text="There was an issue loading your subscription information. Please try refreshing." />
                <div className="text-xs mt-1 text-muted-foreground">
                  Error: {error}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  <TranslatableText text="Current Plan" />
                </span>
                <div className="flex items-center gap-2">
                  {isPremium && isTrialActive ? (
                    <div className="flex items-center gap-1 text-blue-600 font-medium">
                      <Clock className="h-4 w-4" />
                      <TranslatableText text="Premium Trial" />
                    </div>
                  ) : isPremium ? (
                    <div className="flex items-center gap-1 text-orange-600 font-medium">
                      <Crown className="h-4 w-4" />
                      <TranslatableText text="Premium" />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      <TranslatableText text="Free Plan" />
                    </span>
                  )}
                </div>
              </div>

              {isTrialActive && trialEndDate && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      <TranslatableText text="Trial ends on" />
                    </span>
                    <span className="text-blue-900 dark:text-blue-100 font-semibold">
                      {formatTrialEndDate(trialEndDate)}
                    </span>
                  </div>
                  {daysRemainingInTrial >= 0 && (
                    <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      {daysRemainingInTrial === 0 ? (
                        <TranslatableText text="Trial ends today" />
                      ) : daysRemainingInTrial === 1 ? (
                        <TranslatableText text="1 day remaining" />
                      ) : (
                        <>
                          {daysRemainingInTrial} <TranslatableText text="days remaining" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isPremium && !error && (
                <div className="bg-muted/50 rounded-lg p-3 border">
                  <p className="text-sm text-muted-foreground mb-3">
                    <TranslatableText text="Upgrade to Premium for unlimited journaling, advanced insights, and more features." />
                  </p>
                  <Button 
                    onClick={handleUpgradeClick}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white border-0"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    <TranslatableText text="Upgrade to Premium" />
                  </Button>
                </div>
              )}

              {isPremium && !isTrialActive && !error && (
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <TranslatableText text="You have access to all Premium features. Thank you for your support!" />
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  <TranslatableText text="Status" />: {subscriptionStatus || 'free'}
                </span>
                <span>
                  <TranslatableText text="Last updated" />: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <SubscriptionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};
