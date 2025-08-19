import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Crown, Sparkles, Loader2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionModal } from './SubscriptionModal';

interface EnhancedPremiumFeatureGuardProps {
  children: React.ReactNode;
  feature: 'chat' | 'insights';
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export const EnhancedPremiumFeatureGuard: React.FC<EnhancedPremiumFeatureGuardProps> = ({ 
  children, 
  feature,
  fallbackTitle = "Premium Feature",
  fallbackDescription = "This feature requires a premium subscription"
}) => {
  const {
    isPremium,
    hasActiveSubscription,
    isTrialActive,
    daysRemainingInTrial,
    trialEndDate,
    isLoading,
    hasInitialLoadCompleted,
    tier,
    status
  } = useSubscription();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Enhanced debugging
  useEffect(() => {
    if (hasInitialLoadCompleted) {
      const debug = {
        timestamp: new Date().toISOString(),
        subscription: {
          tier,
          status,
          isPremium,
          hasActiveSubscription,
          isTrialActive,
          daysRemainingInTrial,
          trialEndDate: trialEndDate?.toISOString(),
        },
        computed: {
          shouldShowPremiumContent: isPremium && hasActiveSubscription,
          shouldShowTrialContent: isTrialActive && tier === 'premium',
          shouldBlock: !isPremium || !hasActiveSubscription
        }
      };
      
      console.log('[EnhancedPremiumFeatureGuard] Debug info:', debug);
      setDebugInfo(debug);
    }
  }, [
    hasInitialLoadCompleted,
    tier,
    status,
    isPremium,
    hasActiveSubscription,
    isTrialActive,
    daysRemainingInTrial,
    trialEndDate
  ]);

  if (isLoading || !hasInitialLoadCompleted) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <TranslatableText text="Loading subscription status..." />
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Show content if user has premium access (subscription or active trial)
  if (isPremium && hasActiveSubscription) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <TranslatableText text={fallbackTitle} />
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              <TranslatableText text="Premium" />
            </Badge>
          </CardTitle>
          <CardDescription>
            <TranslatableText text={fallbackDescription} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <TranslatableText text="Start your 2-week free trial to unlock this feature" />
            </div>
            
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <Clock className="mr-2 h-4 w-4" />
              <TranslatableText text="Start 2-Week Free Trial" />
            </Button>

            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && debugInfo && (
              <details className="text-xs">
                <summary className="cursor-pointer">Debug Info</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </CardContent>
      </Card>

      <SubscriptionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};