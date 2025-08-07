
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, X, Loader2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useNonBlockingRevenueCat } from '@/hooks/useNonBlockingRevenueCat';
import { useNonBlockingSubscription } from '@/contexts/NonBlockingSubscriptionContext';
import { useLocationPricing } from '@/hooks/useLocationPricing';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PREMIUM_FEATURES = [
  'Unlimited AI chat conversations - Access to the intelligent chat assistant',
  'Advanced emotional insights & analytics - Deep pattern analysis and trends',
  
  'Detailed mood tracking & calendar - Comprehensive mood analysis over time',
  'Priority customer support - Faster response times for help'
];

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose
}) => {
  const { purchaseProduct, isInitializing: revenueCatLoading } = useNonBlockingRevenueCat();
  const { isPremium, isTrialActive } = useNonBlockingSubscription();
  const { pricing, isLoading: pricingLoading, error: pricingError } = useLocationPricing();
  const [isPurchasing, setIsPurchasing] = useState(false);

  console.log('[SubscriptionModal] Current pricing state:', {
    pricing,
    isLoading: pricingLoading,
    error: pricingError
  });

  const handleSubscribe = async () => {
    try {
      setIsPurchasing(true);
      
      console.log('[SubscriptionModal] Starting subscription for product:', pricing.productId);
      
      const success = await purchaseProduct(pricing.productId);
      
      if (success) {
        toast.success(
          <TranslatableText 
            text="Premium subscription activated! Welcome to Premium!" 
            forceTranslate={true} 
          />
        );
        onClose();
      } else {
        toast.error(
          <TranslatableText 
            text="Subscription failed. Please try again." 
            forceTranslate={true} 
          />
        );
      }
    } catch (error) {
      console.error('[SubscriptionModal] Subscription error:', error);
      toast.error(
        <TranslatableText 
          text="An error occurred during subscription. Please try again." 
          forceTranslate={true} 
        />
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    if (!isPurchasing) {
      onClose();
    }
  };

  if (isPremium && !isTrialActive) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center">
              <Crown className="h-6 w-6 text-yellow-500" />
              <TranslatableText text="Already Premium!" />
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              <TranslatableText text="You already have an active premium subscription. Thank you for your support!" />
            </p>
            <Button onClick={handleClose} className="mt-4">
              <TranslatableText text="Close" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center">
            <Crown className="h-6 w-6 text-yellow-500" />
            <TranslatableText text="Upgrade to Premium" />
          </DialogTitle>
          <DialogDescription className="text-center">
            <TranslatableText text="Unlock all premium features and enhance your journaling experience" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Pricing Card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                {pricingLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      <TranslatableText text="Detecting location..." />
                    </span>
                  </div>
                ) : (
                  <>
                    <Badge variant="secondary" className="mb-2">
                      {pricing.country}
                    </Badge>
                    <div className="text-3xl font-bold text-primary">
                      {pricing.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <TranslatableText text="per month" />
                    </div>
                    {isTrialActive && (
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                        <TranslatableText text="Currently in 7-day free trial" />
                      </Badge>
                    )}
                    {pricingError && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">
                        <TranslatableText text="Using default pricing due to location detection issues" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Features List */}
          <div className="space-y-3">
            <h4 className="font-semibold text-center">
              <TranslatableText text="Premium Features" />
            </h4>
            <div className="grid gap-3">
              {PREMIUM_FEATURES.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed">
                    <TranslatableText text={feature} />
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleSubscribe}
              disabled={isPurchasing || revenueCatLoading || pricingLoading}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white border-0"
              size="lg"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <TranslatableText text="Processing..." />
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  <TranslatableText text="Subscribe Now" />
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPurchasing}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              <TranslatableText text="Maybe Later" />
            </Button>
          </div>

          {/* Fine Print */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>
              <TranslatableText text="Subscription will be charged to your Google Play account" />
            </p>
            <p>
              <TranslatableText text="Cancel anytime from your Google Play Store account settings" />
            </p>
            {isTrialActive && (
              <p className="text-blue-600 dark:text-blue-400">
                <TranslatableText text="Your trial will continue until it expires, then billing begins" />
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
