
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, Sparkles } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { revenueCatService } from '@/services/revenueCatService';
import { useToast } from '@/hooks/use-toast';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface SubscriptionPaywallProps {
  onSuccess?: () => void;
  onClose?: () => void;
  showTrialOption?: boolean;
}

export function SubscriptionPaywall({ onSuccess, onClose, showTrialOption = true }: SubscriptionPaywallProps) {
  const { purchaseSubscription, startFreeTrial, loading } = useSubscription();
  const [selectedTier, setSelectedTier] = useState<string>('premium_yearly');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const { toast } = useToast();

  const subscriptionTiers = revenueCatService.getSubscriptionTiers();

  const handlePurchase = async (tierId: string) => {
    try {
      setPurchaseLoading(true);
      await purchaseSubscription(tierId);
      
      toast({
        title: "Welcome to Premium!",
        description: "Your subscription is now active. Enjoy all premium features!",
      });
      
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleFreeTrial = async () => {
    try {
      setTrialLoading(true);
      await startFreeTrial();
      
      toast({
        title: "Free Trial Started!",
        description: "You now have 7 days of premium access. Enjoy!",
      });
      
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Trial Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Crown className="h-12 w-12 text-yellow-500 mr-2" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              <TranslatableText text="Upgrade to Premium" />
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            <TranslatableText text="Unlock the full potential of your mental wellness journey with advanced AI insights and unlimited features." />
          </p>
        </div>

        {/* Free Trial Option */}
        {showTrialOption && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Card className="border-2 border-dashed border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6 text-purple-600 mr-2" />
                  <h3 className="text-xl font-semibold">
                    <TranslatableText text="Start Your Free 7-Day Trial" />
                  </h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  <TranslatableText text="Experience all premium features with no commitment. Cancel anytime." />
                </p>
                <Button
                  onClick={handleFreeTrial}
                  disabled={trialLoading || loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {trialLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  <TranslatableText text="Start Free Trial" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Subscription Plans */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {subscriptionTiers.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={`relative cursor-pointer transition-all duration-200 ${
                  selectedTier === tier.id
                    ? 'ring-2 ring-purple-500 shadow-lg scale-105'
                    : 'hover:shadow-md hover:scale-102'
                } ${tier.isPopular ? 'border-purple-300' : ''}`}
                onClick={() => setSelectedTier(tier.id)}
              >
                {tier.isPopular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600">
                    <TranslatableText text="Most Popular" />
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-3xl font-bold text-purple-600">
                    {tier.price}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    onClick={() => handlePurchase(tier.id)}
                    disabled={purchaseLoading || loading}
                    className={`w-full ${
                      selectedTier === tier.id
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                        : ''
                    }`}
                    variant={selectedTier === tier.id ? 'default' : 'outline'}
                  >
                    {purchaseLoading && selectedTier === tier.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    <TranslatableText text="Choose Plan" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p className="mb-2">
            <TranslatableText text="Cancel anytime. No hidden fees." />
          </p>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="text-sm">
              <TranslatableText text="Continue with Free Version" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
