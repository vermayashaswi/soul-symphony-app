
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
  const [initializationAttempts, setInitializationAttempts] = useState(0);
  const maxInitializationAttempts = 3;

  const initializeRevenueCat = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      
      // Track initialization attempts
      setInitializationAttempts(prev => prev + 1);
      console.log(`[useRevenueCat] Initializing RevenueCat, attempt ${initializationAttempts + 1}/${maxInitializationAttempts}`);

      // Initialize with timeout protection
      await Promise.race([
        revenueCatService.initialize(user.id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("RevenueCat initialization timeout")), 10000)
        )
      ]);

      setIsInitialized(true);
      setInitializationAttempts(0); // Reset counter on success

      // Load products and purchaser info with timeouts
      const productsPromise = Promise.race([
        revenueCatService.getProducts(),
        new Promise<RevenueCatProduct[]>((_, reject) => 
          setTimeout(() => reject(new Error("Products fetch timeout")), 5000)
        )
      ]);

      const purchaserPromise = Promise.race([
        revenueCatService.getPurchaserInfo(),
        new Promise<RevenueCatPurchaserInfo | null>((resolve) => 
          setTimeout(() => resolve(null), 5000) // Use null instead of rejection for purchaser info
        )
      ]);

      const [productsData, purchaserData] = await Promise.all([
        productsPromise.catch(() => [] as RevenueCatProduct[]), // Fallback to empty array
        purchaserPromise
      ]);

      setProducts(productsData);
      setPurchaserInfo(purchaserData);
      
    } catch (error) {
      console.error('[useRevenueCat] Failed to initialize RevenueCat:', error);
      
      if (initializationAttempts >= maxInitializationAttempts) {
        console.warn('[useRevenueCat] Max initialization attempts reached, using fallback mode');
        setIsInitialized(true); // Treat as initialized to prevent further attempts
        
        toast({
          title: 'Subscription Services Limited',
          description: 'Some premium features may not be available. Please check your connection.',
          variant: 'default'
        });
      } else {
        // Will retry on next render due to dependency change
        console.log(`[useRevenueCat] Will retry initialization later, attempts so far: ${initializationAttempts + 1}/${maxInitializationAttempts}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast, initializationAttempts]);

  useEffect(() => {
    if (user?.id && !isInitialized && initializationAttempts < maxInitializationAttempts) {
      initializeRevenueCat();
    }
  }, [user?.id, isInitialized, initializeRevenueCat, initializationAttempts]);

  const refreshPurchaserInfo = useCallback(async () => {
    if (!isInitialized) return;

    try {
      setIsLoading(true);
      
      const purchaserData = await Promise.race([
        revenueCatService.getPurchaserInfo(),
        new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 5000)
        )
      ]);
      
      // Only update if we got actual data
      if (purchaserData) {
        setPurchaserInfo(purchaserData);
      }
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
      await revenueCatService.purchaseProduct(productId);
      
      // Refresh purchaser info after successful purchase
      await refreshPurchaserInfo();
      
      toast({
        title: 'Trial Started!',
        description: 'Your 2-week free trial has begun. Enjoy premium features!',
        variant: 'default'
      });
      
      return true;
    } catch (error) {
      console.error('[useRevenueCat] Purchase failed:', error);
      toast({
        title: 'Purchase Failed',
        description: 'Failed to start your trial. Please try again later.',
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
      
      // Only update if we got actual data
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

  // Computed values with graceful degradation
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
