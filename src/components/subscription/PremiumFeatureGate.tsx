
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Lock, Sparkles } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { SubscriptionPaywall } from './SubscriptionPaywall';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface PremiumFeatureGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showTrialOption?: boolean;
}

export function PremiumFeatureGate({ 
  feature, 
  description, 
  children, 
  fallback,
  showTrialOption = true 
}: PremiumFeatureGateProps) {
  const { isPremiumFeatureAvailable } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  // If user has premium access, show the feature
  if (isPremiumFeatureAvailable()) {
    return <>{children}</>;
  }

  // If there's a custom fallback, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show the paywall if requested
  if (showPaywall) {
    return (
      <SubscriptionPaywall
        onSuccess={() => setShowPaywall(false)}
        onClose={() => setShowPaywall(false)}
        showTrialOption={showTrialOption}
      />
    );
  }

  // Default premium gate UI
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4"
    >
      <Card className="border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <Crown className="h-12 w-12 text-yellow-500" />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center mb-2">
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 dark:from-purple-800 dark:to-blue-800 dark:text-purple-200">
              <Crown className="h-3 w-3 mr-1" />
              <TranslatableText text="Premium Feature" />
            </Badge>
          </div>
          
          <CardTitle className="text-2xl bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            <TranslatableText text={feature} />
          </CardTitle>
          
          {description && (
            <CardDescription className="text-base mt-2">
              <TranslatableText text={description} />
            </CardDescription>
          )}
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-purple-200 dark:border-purple-700">
            <Lock className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              <TranslatableText text="This feature requires a Premium subscription to unlock advanced capabilities and unlimited usage." />
            </p>
          </div>
          
          <div className="space-y-3">
            <Button
              onClick={() => setShowPaywall(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Crown className="h-4 w-4 mr-2" />
              <TranslatableText text="Upgrade to Premium" />
            </Button>
            
            {showTrialOption && (
              <Button
                onClick={() => setShowPaywall(true)}
                variant="outline"
                className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-950"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                <TranslatableText text="Start 7-Day Free Trial" />
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            <TranslatableText text="Cancel anytime • No hidden fees • 7-day money-back guarantee" />
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
