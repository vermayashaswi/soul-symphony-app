
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Crown, Calendar, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { useToast } from '@/hooks/use-toast';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { format } from 'date-fns';

export function SubscriptionSettings() {
  const { subscriptionStatus, loading, restorePurchases, refreshSubscription } = useSubscription();
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const { toast } = useToast();

  const handleRestorePurchases = async () => {
    try {
      setRestoreLoading(true);
      await restorePurchases();
      
      toast({
        title: "Purchases Restored",
        description: "Your subscription has been restored successfully.",
      });
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: error instanceof Error ? error.message : "Failed to restore purchases.",
        variant: "destructive"
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleRefreshSubscription = async () => {
    try {
      setRefreshLoading(true);
      await refreshSubscription();
      
      toast({
        title: "Subscription Updated",
        description: "Your subscription status has been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh subscription status.",
        variant: "destructive"
      });
    } finally {
      setRefreshLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            <TranslatableText text="Loading subscription details..." />
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Crown className="h-5 w-5 mr-2 text-yellow-500" />
              <CardTitle>
                <TranslatableText text="Subscription Status" />
              </CardTitle>
            </div>
            <Badge variant={subscriptionStatus.isActive || subscriptionStatus.isInTrial ? "default" : "secondary"}>
              {subscriptionStatus.isActive 
                ? "Premium" 
                : subscriptionStatus.isInTrial 
                  ? "Trial" 
                  : "Free"}
            </Badge>
          </div>
          <CardDescription>
            <TranslatableText text="Manage your subscription and billing preferences" />
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Current Plan */}
            <div className="flex items-center justify-between">
              <span className="font-medium">
                <TranslatableText text="Current Plan:" />
              </span>
              <span className="capitalize">
                {subscriptionStatus.tier === 'premium' 
                  ? 'Premium' 
                  : subscriptionStatus.isInTrial 
                    ? 'Free Trial' 
                    : 'Free'
                }
              </span>
            </div>

            {/* Trial Information */}
            {subscriptionStatus.isInTrial && subscriptionStatus.trialEndsAt && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center mb-2">
                  <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    <TranslatableText text="Free Trial Active" />
                  </span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  <TranslatableText text="Your trial ends on" /> {format(subscriptionStatus.trialEndsAt, 'PPP')}
                </p>
              </div>
            )}

            {/* Expiration Date */}
            {subscriptionStatus.isActive && subscriptionStatus.expirationDate && (
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  <TranslatableText text="Renewal Date:" />
                </span>
                <span>{format(subscriptionStatus.expirationDate, 'PPP')}</span>
              </div>
            )}

            {/* Free Plan Message */}
            {!subscriptionStatus.isActive && !subscriptionStatus.isInTrial && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mr-2" />
                  <span className="font-medium text-amber-900 dark:text-amber-100">
                    <TranslatableText text="Free Plan Limitations" />
                  </span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-200">
                  <TranslatableText text="Upgrade to Premium to unlock unlimited journal entries, advanced AI insights, and more." />
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>
            <TranslatableText text="Subscription Actions" />
          </CardTitle>
          <CardDescription>
            <TranslatableText text="Manage your subscription settings" />
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleRestorePurchases}
                disabled={restoreLoading}
                variant="outline"
                className="flex-1"
              >
                {restoreLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                <TranslatableText text="Restore Purchases" />
              </Button>
              
              <Button
                onClick={handleRefreshSubscription}
                disabled={refreshLoading}
                variant="outline"
                className="flex-1"
              >
                {refreshLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                <TranslatableText text="Refresh Status" />
              </Button>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <TranslatableText text="• Use 'Restore Purchases' if you purchased on another device" />
              </p>
              <p>
                <TranslatableText text="• Use 'Refresh Status' to sync your latest subscription state" />
              </p>
              <p>
                <TranslatableText text="• To cancel your subscription, use your device's subscription settings" />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
