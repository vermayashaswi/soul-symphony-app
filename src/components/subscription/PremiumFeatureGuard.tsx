
import React, { useState } from 'react';
import { useNonBlockingSubscription } from '@/contexts/NonBlockingSubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Clock, ArrowRight } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { SubscriptionModal } from './SubscriptionModal';

interface PremiumFeatureGuardProps {
  children: React.ReactNode;
  feature: 'chat' | 'insights';
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export const PremiumFeatureGuard: React.FC<PremiumFeatureGuardProps> = ({
  children,
  feature,
  fallbackTitle,
  fallbackDescription
}) => {
  const { 
    hasActiveSubscription, 
    isTrialActive, 
    trialEndDate, 
    daysRemainingInTrial,
    isLoading,
    tier,
    status,
    isTrialEligible
  } = useNonBlockingSubscription();
  const navigate = useNavigate();
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  // Show loading state while subscription data is being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Debug logging for troubleshooting
  console.log('[PremiumFeatureGuard] Subscription check:', {
    feature,
    hasActiveSubscription,
    isTrialActive,
    tier,
    status,
    trialEndDate: trialEndDate?.toISOString(),
    daysRemaining: daysRemainingInTrial,
    isTrialEligible
  });

  // Allow access if user has active subscription or active trial
  if (hasActiveSubscription) {
    console.log('[PremiumFeatureGuard] Access granted - user has active subscription or trial');
    return <>{children}</>;
  }

  // Block access and show upgrade prompt
  const getFeatureTitle = () => {
    if (fallbackTitle) return fallbackTitle;
    return feature === 'chat' ? 'AI Chat Assistant' : 'Advanced Insights';
  };

  const getFeatureDescription = () => {
    if (fallbackDescription) return fallbackDescription;
    return feature === 'chat' 
      ? 'Get personalized insights and guidance from your AI companion'
      : 'Discover deep patterns and trends in your emotional journey';
  };

  const handleUpgrade = () => {
    setIsSubscriptionModalOpen(true);
  };

  const handleStartTrial = () => {
    setIsSubscriptionModalOpen(true);
  };

  console.log('[PremiumFeatureGuard] Access blocked - showing upgrade prompt');

  return (
    <>
      <div className="min-h-screen pb-20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 bg-gradient-to-br from-orange-400 to-pink-600 rounded-full flex items-center justify-center">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl font-bold">
              <TranslatableText text={getFeatureTitle()} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text={getFeatureDescription()} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Trial Status Information - show if trial has ended or if eligible for trial */}
            {trialEndDate && !isTrialActive && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <TranslatableText text="Your 7-day free trial has ended" />
                </div>
                <p className="text-sm">
                  <TranslatableText text="Trial ended on:" />{' '}
                  <span className="font-medium">
                    {format(trialEndDate, 'MMM dd, yyyy')}
                  </span>
                </p>
              </div>
            )}

            {/* Trial Eligibility Information */}
            {isTrialEligible && !trialEndDate && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <Clock className="h-4 w-4" />
                  <TranslatableText text="Start your 7-day free trial" />
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  <TranslatableText text="Get full access to all premium features for 7 days" />
                </p>
              </div>
            )}

            {/* Premium Features List */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                <TranslatableText text="Premium features include:" />
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <TranslatableText text="Unlimited AI chat conversations" /></li>
                <li>• <TranslatableText text="Advanced emotional insights" /></li>
                <li>• <TranslatableText text="Detailed mood tracking" /></li>
                <li>• <TranslatableText text="Export your journal data" /></li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Start Trial Button (if eligible) */}
              {isTrialEligible && !trialEndDate && (
                <Button 
                  onClick={handleStartTrial}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <TranslatableText text="Start 7-Day Free Trial" />
                </Button>
              )}

              {/* Upgrade Button */}
              <Button 
                onClick={handleUpgrade}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700"
                variant={isTrialEligible && !trialEndDate ? "outline" : "default"}
              >
                <Crown className="mr-2 h-4 w-4" />
                <TranslatableText text="Upgrade to Premium" />
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              {/* Alternative: Continue with free features */}
              <Button
                variant="outline"
                onClick={() => navigate('/app/journal')}
                className="w-full"
              >
                <TranslatableText text="Continue with Journal" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />
    </>
  );
};
