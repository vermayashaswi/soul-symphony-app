
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, X, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { subscriptionService } from '@/services/subscriptionService';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  description?: string;
}

export function SubscriptionPromptModal({
  isOpen,
  onClose,
  feature,
  description = "This feature requires a premium subscription to continue."
}: SubscriptionPromptModalProps) {
  const { refreshSubscription, subscriptionStatus } = useSubscription();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [offerings, setOfferings] = useState<any[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      loadOfferings();
    }
  }, [isOpen]);

  const loadOfferings = async () => {
    try {
      const offers = await subscriptionService.getOfferings();
      setOfferings(offers);
    } catch (error) {
      console.error('Failed to load offerings:', error);
      toast({
        title: "Error",
        description: "Failed to load subscription options. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePurchase = async (packageToPurchase: any) => {
    setIsLoading(true);
    try {
      await subscriptionService.purchasePackage(packageToPurchase);
      await refreshSubscription();
      
      toast({
        title: "Success!",
        description: "Welcome to Premium! You now have access to all features.",
      });
      
      onClose();
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      if (error.userCancelled) {
        // User cancelled, no need to show error
        return;
      }
      
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsLoading(true);
    try {
      await subscriptionService.restorePurchases();
      await refreshSubscription();
      
      toast({
        title: "Purchases Restored",
        description: "Your previous purchases have been restored.",
      });
      
      onClose();
    } catch (error) {
      console.error('Restore failed:', error);
      toast({
        title: "Restore Failed",
        description: "No previous purchases found or restore failed.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const premiumFeatures = [
    "Unlimited chat conversations with Rūḥ",
    "Advanced insights and analytics",
    "Sentiment tracking over time",
    "Export your journal data",
    "Priority customer support",
    "No ads or limitations"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-purple-600" />
            Unlock {feature}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trial status if applicable */}
          {subscriptionStatus.isTrialActive && (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
              <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                Trial Active
              </h4>
              <p className="text-sm text-orange-600 dark:text-orange-300">
                Your trial expires in {subscriptionStatus.trialEndsAt && 
                  Math.ceil((subscriptionStatus.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days.
                Upgrade now to continue enjoying premium features.
              </p>
            </div>
          )}

          {/* Premium features list */}
          <div>
            <h4 className="font-medium mb-3">Premium includes:</h4>
            <div className="space-y-2">
              {premiumFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription options */}
          {offerings.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Choose your plan:</h4>
              {offerings[0]?.availablePackages?.map((pkg: any) => (
                <div key={pkg.identifier} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium">{pkg.product.title}</h5>
                      <p className="text-sm text-muted-foreground">
                        {pkg.product.description}
                      </p>
                    </div>
                    {pkg.product.introPrice && (
                      <Badge variant="secondary">7-Day Free Trial</Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-lg font-bold">
                      {pkg.product.priceString}
                    </div>
                    <Button
                      onClick={() => handlePurchase(pkg)}
                      disabled={isLoading}
                      size="sm"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Start Trial'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={handleRestorePurchases}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Restore Purchases
            </Button>
            
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Maybe Later
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime. No commitments.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
