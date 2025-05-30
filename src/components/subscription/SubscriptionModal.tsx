
import React, { useState, useEffect } from 'react';
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
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PricingTier {
  currency: string;
  price: string;
  originalPrice?: string;
  region: string;
  productId: string;
}

// Location-based pricing configuration
const PRICING_TIERS: Record<string, PricingTier> = {
  IN: { currency: 'INR', price: '₹99', region: 'India', productId: 'premium_monthly_in' },
  US: { currency: 'USD', price: '$4.99', region: 'United States', productId: 'premium_monthly_us' },
  GB: { currency: 'GBP', price: '£3.99', region: 'United Kingdom', productId: 'premium_monthly_gb' },
  CA: { currency: 'CAD', price: '$5.49', region: 'Canada', productId: 'premium_monthly_ca' },
  AU: { currency: 'AUD', price: '$6.49', region: 'Australia', productId: 'premium_monthly_au' },
  DE: { currency: 'EUR', price: '€4.99', region: 'Germany', productId: 'premium_monthly_de' },
  FR: { currency: 'EUR', price: '€4.99', region: 'France', productId: 'premium_monthly_fr' },
  IT: { currency: 'EUR', price: '€4.99', region: 'Italy', productId: 'premium_monthly_it' },
  ES: { currency: 'EUR', price: '€4.99', region: 'Spain', productId: 'premium_monthly_es' },
  NL: { currency: 'EUR', price: '€4.99', region: 'Netherlands', productId: 'premium_monthly_nl' },
  SE: { currency: 'EUR', price: '€6.49', region: 'Sweden', productId: 'premium_monthly_se' },
  NO: { currency: 'EUR', price: '€6.49', region: 'Norway', productId: 'premium_monthly_no' },
  DK: { currency: 'EUR', price: '€6.49', region: 'Denmark', productId: 'premium_monthly_dk' },
  AE: { currency: 'AED', price: '19.99 AED', region: 'UAE', productId: 'premium_monthly_ae' },
  SA: { currency: 'SAR', price: '19.99 SAR', region: 'Saudi Arabia', productId: 'premium_monthly_sa' },
  JP: { currency: 'JPY', price: '¥600', region: 'Japan', productId: 'premium_monthly_jp' },
  KR: { currency: 'KRW', price: '₩5,900', region: 'South Korea', productId: 'premium_monthly_kr' },
  SG: { currency: 'USD', price: '$1.49', region: 'Singapore', productId: 'premium_monthly_sg' },
  MY: { currency: 'USD', price: '$1.49', region: 'Malaysia', productId: 'premium_monthly_my' },
  TH: { currency: 'USD', price: '$1.49', region: 'Thailand', productId: 'premium_monthly_th' },
  MX: { currency: 'MXN', price: 'MX$29.99', region: 'Mexico', productId: 'premium_monthly_mx' },
  BR: { currency: 'BRL', price: 'R$9.99', region: 'Brazil', productId: 'premium_monthly_br' },
  ZA: { currency: 'USD', price: '$1.49', region: 'South Africa', productId: 'premium_monthly_za' },
  NG: { currency: 'USD', price: '$0.99', region: 'Nigeria', productId: 'premium_monthly_ng' },
  // Default fallback
  DEFAULT: { currency: 'USD', price: '$4.99', region: 'Global', productId: 'premium_monthly_default' }
};

const PREMIUM_FEATURES = [
  'Unlimited journal entries',
  'Advanced emotion insights',
  'AI-powered themes extraction',
  'Detailed analytics and trends',
  'Export your data',
  'Priority customer support',
  'Dark mode themes',
  'Voice recording unlimited'
];

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose
}) => {
  const { purchaseProduct, isLoading: revenueCatLoading } = useRevenueCat();
  const { isPremium, isTrialActive } = useSubscription();
  const [currentPricing, setCurrentPricing] = useState<PricingTier>(PRICING_TIERS.DEFAULT);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Detect user location for pricing
  useEffect(() => {
    const detectLocation = async () => {
      try {
        setIsLocationLoading(true);
        
        // Try to get location from browser geolocation API
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              // Use reverse geocoding service to get country code
              // For now, we'll use a simple IP-based approach
              await getLocationFromIP();
            },
            async () => {
              // Fallback to IP-based detection
              await getLocationFromIP();
            }
          );
        } else {
          await getLocationFromIP();
        }
      } catch (error) {
        console.error('Location detection failed:', error);
        setCurrentPricing(PRICING_TIERS.DEFAULT);
      } finally {
        setIsLocationLoading(false);
      }
    };

    const getLocationFromIP = async () => {
      try {
        // Use a free IP geolocation service
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        if (data.country_code && PRICING_TIERS[data.country_code]) {
          setCurrentPricing(PRICING_TIERS[data.country_code]);
        } else {
          setCurrentPricing(PRICING_TIERS.DEFAULT);
        }
      } catch (error) {
        console.error('IP geolocation failed:', error);
        setCurrentPricing(PRICING_TIERS.DEFAULT);
      }
    };

    if (isOpen) {
      detectLocation();
    }
  }, [isOpen]);

  const handleSubscribe = async () => {
    try {
      setIsPurchasing(true);
      
      console.log('[SubscriptionModal] Starting subscription for product:', currentPricing.productId);
      
      const success = await purchaseProduct(currentPricing.productId);
      
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
                {isLocationLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      <TranslatableText text="Detecting location..." />
                    </span>
                  </div>
                ) : (
                  <>
                    <Badge variant="secondary" className="mb-2">
                      {currentPricing.region}
                    </Badge>
                    <div className="text-3xl font-bold text-primary">
                      {currentPricing.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <TranslatableText text="per month" />
                    </div>
                    {isTrialActive && (
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                        <TranslatableText text="Currently in 7-day free trial" />
                      </Badge>
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
            <div className="grid gap-2">
              {PREMIUM_FEATURES.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">
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
              disabled={isPurchasing || revenueCatLoading || isLocationLoading}
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
