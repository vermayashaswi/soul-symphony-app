
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { revenueCatService, RevenueCatPurchaserInfo, RevenueCatProduct } from '@/services/revenuecat/revenueCatService';
import { useToast } from '@/hooks/use-toast';

export interface UseRevenueCatReturn {
  isInitialized: boolean;
  purchaserInfo: RevenueCatPurchaserInfo | null;
  products: RevenueCatProduct[];
  isLoading: boolean;
  isPremium: boolean;
  isTrialActive: boolean;
  trialEndDate: Date | null;
  daysRemainingInTrial: number;
  purchaseProduct: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkTrialEligibility: (productId: string) => Promise<boolean>;
  refreshPurchaserInfo: () => Promise<void>;
}

export const useRevenueCat = (): UseRevenueCatReturn => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const [purchaserInfo, setPurchaserInfo] = useState<RevenueCatPurchaserInfo | null>(null);
  const [products, setProducts] = useState<RevenueCatProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const initializeRevenueCat = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      await revenueCatService.initialize(user.id);
      setIsInitialized(true);

      // Load products and purchaser info
      const [productsData, purchaserData] = await Promise.all([
        revenueCatService.getProducts(),
        revenueCatService.getPurchaserInfo()
      ]);

      setProducts(productsData);
      setPurchaserInfo(purchaserData);
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      toast({
        title: 'Subscription Error',
        description: 'Failed to load subscription information. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id && !isInitialized) {
      initializeRevenueCat();
    }
  }, [user?.id, isInitialized, initializeRevenueCat]);

  const refreshPurchaserInfo = useCallback(async () => {
    if (!isInitialized) return;

    try {
      const purchaserData = await revenueCatService.getPurchaserInfo();
      setPurchaserInfo(purchaserData);
    } catch (error) {
      console.error('Failed to refresh purchaser info:', error);
    }
  }, [isInitialized]);

  const purchaseProduct = useCallback(async (productId: string): Promise<boolean> => {
    if (!isInitialized) {
      toast({
        title: 'Error',
        description: 'Subscription service not initialized',
        variant: 'destructive'
      });
      return false;
    }

    try {
      setIsLoading(true);
      await revenueCatService.purchaseProduct(productId);
      
      // Refresh purchaser info after successful purchase
      await refreshPurchaserInfo();
      
      toast({
        title: 'Trial Started!',
        description: 'Your 7-day free trial has begun. Enjoy premium features!',
        variant: 'default'
      });
      
      return true;
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        title: 'Purchase Failed',
        description: 'Failed to start your trial. Please try again.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, refreshPurchaserInfo, toast]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!isInitialized) return false;

    try {
      setIsLoading(true);
      const restored = await revenueCatService.restorePurchases();
      setPurchaserInfo(restored);
      
      if (restored) {
        toast({
          title: 'Purchases Restored',
          description: 'Your subscription has been restored successfully.',
          variant: 'default'
        });
        return true;
      } else {
        toast({
          title: 'No Purchases Found',
          description: 'No previous purchases were found to restore.',
          variant: 'default'
        });
        return false;
      }
    } catch (error) {
      console.error('Restore failed:', error);
      toast({
        title: 'Restore Failed',
        description: 'Failed to restore purchases. Please try again.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, toast]);

  const checkTrialEligibility = useCallback(async (productId: string): Promise<boolean> => {
    if (!isInitialized) return false;
    
    try {
      return await revenueCatService.checkTrialEligibility(productId);
    } catch (error) {
      console.error('Failed to check trial eligibility:', error);
      return false;
    }
  }, [isInitialized]);

  // Computed values
  const isPremium = revenueCatService.isUserPremium(purchaserInfo);
  const trialEndDate = revenueCatService.getTrialEndDate(purchaserInfo);
  const isTrialActive = trialEndDate ? trialEndDate > new Date() : false;
  
  const daysRemainingInTrial = trialEndDate 
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    isInitialized,
    purchaserInfo,
    products,
    isLoading,
    isPremium,
    isTrialActive,
    trialEndDate,
    daysRemainingInTrial,
    purchaseProduct,
    restorePurchases,
    checkTrialEligibility,
    refreshPurchaserInfo
  };
};
