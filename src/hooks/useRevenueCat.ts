
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { revenueCatService, RevenueCatPurchaserInfo, RevenueCatProduct } from '@/services/revenuecat/revenueCatService';
import { useToast } from '@/hooks/use-toast';
import { REVENUECAT_CONFIG } from '@/config/revenueCatConfig';

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
      
      console.log('[useRevenueCat] Initializing RevenueCat service');
      await revenueCatService.initialize(user.id);
      setIsInitialized(true);

      // Load products and purchaser info
      const [productsData, purchaserData] = await Promise.allSettled([
        revenueCatService.getProducts(),
        revenueCatService.getPurchaserInfo()
      ]);

      if (productsData.status === 'fulfilled') {
        setProducts(productsData.value);
      } else {
        console.warn('[useRevenueCat] Failed to load products:', productsData.reason);
      }

      if (purchaserData.status === 'fulfilled') {
        setPurchaserInfo(purchaserData.value);
      } else {
        console.warn('[useRevenueCat] Failed to load purchaser info:', purchaserData.reason);
      }
      
    } catch (error) {
      console.error('[useRevenueCat] Failed to initialize RevenueCat:', error);
      
      toast({
        title: 'Subscription Services Limited',
        description: 'Some premium features may not be available. Please check your connection.',
        variant: 'default'
      });
      
      // Still mark as initialized to prevent blocking
      setIsInitialized(true);
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
      setIsLoading(true);
      const purchaserData = await revenueCatService.getPurchaserInfo();
      setPurchaserInfo(purchaserData);
    } catch (error) {
      console.error('[useRevenueCat] Failed to refresh purchaser info:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const purchaseProduct = useCallback(async (productId: string): Promise<boolean> => {
    if (!isInitialized) {
      toast({
        title: 'Service Unavailable',
        description: 'Subscription service not initialized. Please try again later.',
        variant: 'destructive'
      });
      return false;
    }

    try {
      setIsLoading(true);
      
      console.log('[useRevenueCat] Starting purchase for product:', productId);
      const transaction = await revenueCatService.purchaseProduct(productId);
      
      if (transaction) {
        // Refresh purchaser info after successful purchase
        await refreshPurchaserInfo();
        
        toast({
          title: 'Trial Started!',
          description: 'Your 7-day free trial has begun. Enjoy premium features!',
          variant: 'default'
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[useRevenueCat] Purchase failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: 'Purchase Failed',
        description: `Failed to start your trial: ${errorMessage}`,
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
      
      if (restored) {
        setPurchaserInfo(restored);
        
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
      console.error('[useRevenueCat] Restore failed:', error);
      
      toast({
        title: 'Restore Failed',
        description: 'Failed to restore purchases. Please try again later.',
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
      console.error('[useRevenueCat] Failed to check trial eligibility:', error);
      return false;
    }
  }, [isInitialized]);

  // Computed values
  const isPremium = purchaserInfo ? revenueCatService.isUserPremium(purchaserInfo) : false;
  const trialEndDate = purchaserInfo ? revenueCatService.getTrialEndDate(purchaserInfo) : null;
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
