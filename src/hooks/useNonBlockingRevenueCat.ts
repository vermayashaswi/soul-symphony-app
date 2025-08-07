import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { revenueCatService, RevenueCatPurchaserInfo, RevenueCatProduct } from '@/services/revenuecat/revenueCatService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { toast } from 'sonner';

interface NonBlockingRevenueCatState {
  isInitialized: boolean;
  isInitializing: boolean;
  initializationFailed: boolean;
  retryCount: number;
  products: RevenueCatProduct[];
  purchaserInfo: RevenueCatPurchaserInfo | null;
  isPremium: boolean;
  isTrialActive: boolean;
  trialEndDate: Date | null;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export const useNonBlockingRevenueCat = () => {
  const { user } = useAuth();
  const [state, setState] = useState<NonBlockingRevenueCatState>({
    isInitialized: false,
    isInitializing: false,
    initializationFailed: false,
    retryCount: 0,
    products: [],
    purchaserInfo: null,
    isPremium: false,
    isTrialActive: false,
    trialEndDate: null,
  });

  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const initializeRevenueCat = useCallback(async (retryAttempt = 0): Promise<void> => {
    if (!user) {
      console.log('[NonBlockingRevenueCat] No user, skipping initialization');
      return;
    }

    if (state.isInitialized || state.isInitializing) {
      console.log('[NonBlockingRevenueCat] Already initialized or initializing');
      return;
    }

    console.log(`[NonBlockingRevenueCat] Starting initialization attempt ${retryAttempt + 1}/${MAX_RETRIES + 1}`);
    
    setState(prev => ({ 
      ...prev, 
      isInitializing: true,
      initializationFailed: false,
      retryCount: retryAttempt
    }));

    try {
      // Initialize RevenueCat with timeout
      const initPromise = revenueCatService.initialize(user.id);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RevenueCat initialization timeout')), 10000)
      );

      await Promise.race([initPromise, timeoutPromise]);

      // Fetch products and purchaser info in parallel
      const [products, purchaserInfo] = await Promise.allSettled([
        revenueCatService.getProducts(),
        revenueCatService.getPurchaserInfo()
      ]);

      const finalProducts = products.status === 'fulfilled' ? products.value : [];
      const finalPurchaserInfo = purchaserInfo.status === 'fulfilled' ? purchaserInfo.value : null;

      // Calculate premium status
      const isPremium = revenueCatService.isUserPremium(finalPurchaserInfo);
      const trialEndDate = revenueCatService.getTrialEndDate(finalPurchaserInfo);
      const isTrialActive = trialEndDate ? trialEndDate > new Date() : false;

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isInitializing: false,
        initializationFailed: false,
        products: finalProducts,
        purchaserInfo: finalPurchaserInfo,
        isPremium,
        isTrialActive,
        trialEndDate,
        retryCount: 0
      }));

      setErrorDetails(null);
      console.log('[NonBlockingRevenueCat] Initialization successful');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[NonBlockingRevenueCat] Initialization failed (attempt ${retryAttempt + 1}):`, errorMessage);
      
      setErrorDetails(errorMessage);

      // Retry logic
      if (retryAttempt < MAX_RETRIES) {
        console.log(`[NonBlockingRevenueCat] Retrying in ${RETRY_DELAY_MS}ms...`);
        setState(prev => ({ 
          ...prev, 
          isInitializing: false,
          retryCount: retryAttempt + 1
        }));
        
        setTimeout(() => {
          initializeRevenueCat(retryAttempt + 1);
        }, RETRY_DELAY_MS);
      } else {
        console.error('[NonBlockingRevenueCat] Max retries reached, marking as failed');
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isInitializing: false,
          initializationFailed: true,
          retryCount: retryAttempt + 1
        }));

        // Only show toast if running natively and this is a critical error
        if (nativeIntegrationService.isRunningNatively()) {
          toast.error('Subscription service unavailable. App functionality may be limited.');
        }
      }
    }
  }, [user, state.isInitialized, state.isInitializing]);

  // Manual retry function
  const retryInitialization = useCallback(() => {
    if (state.isInitializing) return;
    
    setState(prev => ({
      ...prev,
      initializationFailed: false,
      retryCount: 0
    }));
    
    initializeRevenueCat(0);
  }, [initializeRevenueCat, state.isInitializing]);

  // Purchase product function
  const purchaseProduct = useCallback(async (productId: string) => {
    if (!state.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }
    
    try {
      const purchaserInfo = await revenueCatService.purchaseProduct(productId);
      
      // Update state with new purchaser info
      const isPremium = revenueCatService.isUserPremium(purchaserInfo);
      const trialEndDate = revenueCatService.getTrialEndDate(purchaserInfo);
      const isTrialActive = trialEndDate ? trialEndDate > new Date() : false;

      setState(prev => ({
        ...prev,
        purchaserInfo,
        isPremium,
        isTrialActive,
        trialEndDate
      }));

      return purchaserInfo;
    } catch (error) {
      console.error('[NonBlockingRevenueCat] Purchase failed:', error);
      throw error;
    }
  }, [state.isInitialized]);

  // Restore purchases function
  const restorePurchases = useCallback(async () => {
    if (!state.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }
    
    try {
      const purchaserInfo = await revenueCatService.restorePurchases();
      
      // Update state with restored info
      const isPremium = revenueCatService.isUserPremium(purchaserInfo);
      const trialEndDate = revenueCatService.getTrialEndDate(purchaserInfo);
      const isTrialActive = trialEndDate ? trialEndDate > new Date() : false;

      setState(prev => ({
        ...prev,
        purchaserInfo,
        isPremium,
        isTrialActive,
        trialEndDate
      }));

      return purchaserInfo;
    } catch (error) {
      console.error('[NonBlockingRevenueCat] Restore failed:', error);
      throw error;
    }
  }, [state.isInitialized]);

  // Initialize on user change
  useEffect(() => {
    if (user && !state.isInitialized && !state.isInitializing) {
      // Start initialization in background
      setTimeout(() => {
        initializeRevenueCat(0);
      }, 100);
    } else if (!user) {
      // Reset state when user logs out
      setState({
        isInitialized: false,
        isInitializing: false,
        initializationFailed: false,
        retryCount: 0,
        products: [],
        purchaserInfo: null,
        isPremium: false,
        isTrialActive: false,
        trialEndDate: null,
      });
      setErrorDetails(null);
    }
  }, [user, state.isInitialized, state.isInitializing, initializeRevenueCat]);

  return {
    // State
    isInitialized: state.isInitialized,
    isInitializing: state.isInitializing,
    initializationFailed: state.initializationFailed,
    retryCount: state.retryCount,
    errorDetails,
    
    // Data
    products: state.products,
    purchaserInfo: state.purchaserInfo,
    isPremium: state.isPremium,
    isTrialActive: state.isTrialActive,
    trialEndDate: state.trialEndDate,
    
    // Actions
    retryInitialization,
    purchaseProduct,
    restorePurchases,
    
    // Legacy compatibility
    refreshPurchaserInfo: restorePurchases,
    checkTrialEligibility: async (productId: string) => {
      if (!state.isInitialized) return false;
      try {
        return await revenueCatService.checkTrialEligibility(productId);
      } catch {
        return false;
      }
    }
  };
};