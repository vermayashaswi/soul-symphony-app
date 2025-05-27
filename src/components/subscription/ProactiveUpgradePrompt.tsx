
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Sparkles, X, Heart } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { SubscriptionPaywall } from './SubscriptionPaywall';

interface ProactiveUpgradePromptProps {
  trigger: 'positive_sentiment' | 'trial_expiring' | 'feature_usage' | 'streak_milestone';
  onDismiss?: () => void;
}

export function ProactiveUpgradePrompt({ trigger, onDismiss }: ProactiveUpgradePromptProps) {
  const { subscriptionStatus } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Don't show if already premium
  if (subscriptionStatus.isActive) return null;

  if (showPaywall) {
    return (
      <SubscriptionPaywall
        onSuccess={() => setShowPaywall(false)}
        onClose={() => setShowPaywall(false)}
        showTrialOption={!subscriptionStatus.isInTrial}
      />
    );
  }

  const getPromptContent = () => {
    switch (trigger) {
      case 'positive_sentiment':
        return {
          icon: <Heart className="h-6 w-6 text-pink-500" />,
          title: "We're so glad you're feeling better! 💖",
          description: "Your positive progress deserves premium support. Unlock advanced insights to continue your wellness journey.",
          ctaText: "Upgrade to Premium"
        };
      
      case 'trial_expiring':
        return {
          icon: <Sparkles className="h-6 w-6 text-amber-500" />,
          title: "Don't lose your progress! ⏰",
          description: "Your trial expires soon. Keep all your premium features and continue your mental wellness journey.",
          ctaText: "Continue with Premium"
        };
      
      case 'feature_usage':
        return {
          icon: <Crown className="h-6 w-6 text-purple-500" />,
          title: "You're loving the premium features! ✨",
          description: "Upgrade now to keep unlimited access to all the tools that are helping you grow.",
          ctaText: "Unlock Full Access"
        };
      
      case 'streak_milestone':
        return {
          icon: <Sparkles className="h-6 w-6 text-green-500" />,
          title: "Amazing streak! You're on fire! 🔥",
          description: "Celebrate your consistency with premium features designed to support long-term wellness habits.",
          ctaText: "Upgrade to Premium"
        };
      
      default:
        return {
          icon: <Crown className="h-6 w-6 text-purple-500" />,
          title: "Ready for the next level?",
          description: "Unlock premium features to enhance your mental wellness journey.",
          ctaText: "Upgrade Now"
        };
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  const content = getPromptContent();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {content.icon}
                  <CardTitle className="text-lg">
                    <TranslatableText text={content.title} />
                  </CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={handleDismiss}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <CardDescription className="text-sm">
                <TranslatableText text={content.description} />
              </CardDescription>
              
              <div className="space-y-2">
                <Button
                  onClick={() => setShowPaywall(true)}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  <TranslatableText text={content.ctaText} />
                </Button>
                
                <Button variant="ghost" size="sm" onClick={handleDismiss} className="w-full">
                  <TranslatableText text="Maybe later" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
