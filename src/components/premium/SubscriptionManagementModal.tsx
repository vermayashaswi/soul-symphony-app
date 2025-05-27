
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Star, Loader2, Calendar, CreditCard } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { subscriptionService } from '@/services/subscriptionService';
import { useToast } from '@/hooks/use-toast';
import { PremiumBadge } from './PremiumBadge';

interface SubscriptionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionManagementModal({
  isOpen,
  onClose
}: SubscriptionManagementModalProps) {
  const { 
    subscriptionStatus, 
    refreshSubscription, 
    daysUntilTrialExpires,
    hasActiveSubscription,
    hasActiveTrialOrSubscription 
  } = useSubscription();
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
        description: "Your subscription has been updated successfully.",
      });
      
      onClose();
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      if (error.userCancelled) {
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

  const formatExpirationDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-purple-600" />
            Subscription Management
          </DialogTitle>
          <DialogDescription>
            Manage your Soulo Premium subscription
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Status</span>
                <PremiumBadge />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasActiveTrialOrSubscription ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {subscriptionStatus.isTrialActive ? (
                        <>Trial expires: {formatExpirationDate(subscriptionStatus.trialEndsAt)}</>
                      ) : (
                        <>Next billing: {formatExpirationDate(subscriptionStatus.expiresAt)}</>
                      )}
                    </span>
                  </div>
                  {subscriptionStatus.productId && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Plan: {subscriptionStatus.productId}</span>
                    </div>
                  )}
                  {subscriptionStatus.isTrialActive && daysUntilTrialExpires !== null && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        Your trial expires in {daysUntilTrialExpires} days. 
                        {daysUntilTrialExpires <= 3 && " Upgrade now to continue enjoying premium features."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    You're currently on the free plan. Upgrade to unlock all premium features.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Premium Features */}
          <Card>
            <CardHeader>
              <CardTitle>Premium Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "Unlimited chat conversations with Rūḥ",
                  "Advanced insights and analytics",
                  "Sentiment tracking over time",
                  "Export your journal data",
                  "Priority customer support",
                  "No ads or limitations"
                ].map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subscription Options */}
          {(!hasActiveSubscription || subscriptionStatus.isTrialActive) && offerings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {subscriptionStatus.isTrialActive ? 'Upgrade Your Plan' : 'Choose Your Plan'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {offerings[0]?.availablePackages?.map((pkg: any) => (
                  <div key={pkg.identifier} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
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
                        ) : subscriptionStatus.isTrialActive ? (
                          'Upgrade Now'
                        ) : (
                          'Start Trial'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
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
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime. No commitments. Manage your subscription through your app store.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
