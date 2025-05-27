
import { useState, useEffect } from 'react';
import { revenueCatService, SubscriptionStatus } from '@/services/revenueCatService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSubscription() {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isActive: false,
    tier: 'free',
    isInTrial: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      initializeSubscription();
    }
  }, [user]);

  const initializeSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      // Initialize RevenueCat
      await revenueCatService.initialize(user!.id);

      // Get subscription status from database first
      await fetchSubscriptionFromDatabase();

      // Then sync with RevenueCat
      await syncWithRevenueCat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize subscription');
      console.error('Subscription initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionFromDatabase = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_premium, subscription_tier, trial_ends_at')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      if (profile) {
        const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
        const isInTrial = trialEndsAt ? trialEndsAt > new Date() : false;

        setSubscriptionStatus({
          isActive: profile.is_premium || false,
          tier: profile.subscription_tier || 'free',
          isInTrial,
          trialEndsAt: trialEndsAt || undefined
        });
      }
    } catch (error) {
      console.error('Error fetching subscription from database:', error);
    }
  };

  const syncWithRevenueCat = async () => {
    try {
      const customerInfo = await revenueCatService.getCustomerInfo();
      if (customerInfo) {
        const isActive = Object.keys(customerInfo.entitlements.active).length > 0;
        const activeEntitlement = Object.values(customerInfo.entitlements.active)[0];
        
        setSubscriptionStatus(prev => ({
          ...prev,
          isActive,
          tier: isActive ? 'premium' : 'free',
          expirationDate: customerInfo.latestExpirationDate 
            ? new Date(customerInfo.latestExpirationDate)
            : undefined,
          isInTrial: activeEntitlement?.isInIntroOfferPeriod || false
        }));
      }
    } catch (error) {
      console.error('Error syncing with RevenueCat:', error);
    }
  };

  const purchaseSubscription = async (packageId: string) => {
    try {
      setLoading(true);
      setError(null);

      const offerings = await revenueCatService.getOfferings();
      const targetPackage = offerings
        .flatMap(offering => offering.availablePackages || [])
        .find(pkg => pkg.identifier === packageId);

      if (!targetPackage) {
        throw new Error('Package not found');
      }

      await revenueCatService.purchasePackage(targetPackage);
      await syncWithRevenueCat();

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setLoading(true);
      setError(null);

      await revenueCatService.restorePurchases();
      await syncWithRevenueCat();

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Restore failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startFreeTrial = async () => {
    try {
      setLoading(true);
      setError(null);

      // Update trial status in database
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const { error } = await supabase
        .from('profiles')
        .update({
          trial_ends_at: trialEndsAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user!.id);

      if (error) throw error;

      setSubscriptionStatus(prev => ({
        ...prev,
        isInTrial: true,
        trialEndsAt
      }));

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start trial';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isPremiumFeatureAvailable = (feature?: string) => {
    return subscriptionStatus.isActive || subscriptionStatus.isInTrial;
  };

  return {
    subscriptionStatus,
    loading,
    error,
    purchaseSubscription,
    restorePurchases,
    startFreeTrial,
    isPremiumFeatureAvailable,
    refreshSubscription: syncWithRevenueCat
  };
}
