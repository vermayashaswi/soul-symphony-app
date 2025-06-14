
import { supabase } from '@/integrations/supabase/client';
import { REVENUECAT_CONFIG, ProductIdentifier, EntitlementIdentifier } from '@/config/revenueCatConfig';

export interface RevenueCatProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  priceString: string;
  currencyCode: string;
  region?: string;
  introPrice?: {
    price: number;
    priceString: string;
    period: string;
    cycles: number;
    periodUnit: string;
  };
}

export interface RevenueCatPurchaserInfo {
  originalAppUserId: string;
  allPurchasedProductIdentifiers: string[];
  latestExpirationDate?: string;
  activeSubscriptions: string[];
  allExpirationDates: { [productId: string]: string };
  entitlements: {
    all: { [entitlementId: string]: RevenueCatEntitlement };
    active: { [entitlementId: string]: RevenueCatEntitlement };
  };
}

export interface RevenueCatEntitlement {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: 'TRIAL' | 'INTRO' | 'NORMAL';
  latestPurchaseDate: string;
  originalPurchaseDate: string;
  expirationDate?: string;
  store: string;
  productIdentifier: string;
  isSandbox: boolean;
  unsubscribeDetectedAt?: string;
  billingIssueDetectedAt?: string;
}

export interface RevenueCatTransaction {
  transactionIdentifier: string;
  productIdentifier: string;
  purchaseDate: string;
}

// Regional product configurations
const REGIONAL_PRODUCTS: Record<string, RevenueCatProduct> = {
  [REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_IN]: {
    identifier: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_IN,
    description: 'Premium features with 7-day free trial',
    title: 'SOULo Premium Monthly (India)',
    price: 99,
    priceString: '₹99',
    currencyCode: 'INR',
    region: 'India'
  },
  [REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_US]: {
    identifier: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_US,
    description: 'Premium features with 7-day free trial',
    title: 'SOULo Premium Monthly (US)',
    price: 4.99,
    priceString: '$4.99',
    currencyCode: 'USD',
    region: 'United States'
  },
  [REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_GB]: {
    identifier: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_GB,
    description: 'Premium features with 7-day free trial',
    title: 'SOULo Premium Monthly (UK)',
    price: 3.99,
    priceString: '£3.99',
    currencyCode: 'GBP',
    region: 'United Kingdom'
  },
  [REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_DEFAULT]: {
    identifier: REVENUECAT_CONFIG.PRODUCTS.PREMIUM_MONTHLY_DEFAULT,
    description: 'Premium features with 7-day free trial',
    title: 'SOULo Premium Monthly',
    price: 4.99,
    priceString: '$4.99',
    currencyCode: 'USD',
    region: 'Global'
  }
};

class RevenueCatService {
  private isInitialized = false;
  private currentUserId: string | null = null;
  private revenueCatSDK: any = null;

  async initialize(userId: string): Promise<void> {
    try {
      console.log('[RevenueCat] Initializing RevenueCat SDK for user:', userId);
      
      this.currentUserId = userId;
      
      // Initialize RevenueCat SDK for web/React Native
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        // Running in React Native WebView - use postMessage to communicate with native
        this.initializeNativeRevenueCat(userId);
      } else {
        // Running in web browser - use RevenueCat Web SDK or mock implementation
        await this.initializeWebRevenueCat(userId);
      }
      
      // Sync with our backend
      await this.syncUserWithBackend(userId);
      
      this.isInitialized = true;
      console.log('[RevenueCat] Initialization complete');
    } catch (error) {
      console.error('[RevenueCat] Initialization failed:', error);
      throw error;
    }
  }

  private initializeNativeRevenueCat(userId: string): void {
    try {
      // Send initialization message to React Native
      const message = {
        type: 'REVENUECAT_INIT',
        payload: {
          apiKey: REVENUECAT_CONFIG.API_KEY,
          userId: userId,
          environment: REVENUECAT_CONFIG.ENVIRONMENT
        }
      };
      
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
      console.log('[RevenueCat] Native initialization message sent');
    } catch (error) {
      console.error('[RevenueCat] Native initialization failed:', error);
      throw error;
    }
  }

  private async initializeWebRevenueCat(userId: string): Promise<void> {
    try {
      // For web implementation, we'll use a mock for now
      // In production, you would use the RevenueCat Web SDK
      console.log('[RevenueCat] Web SDK initialization (mock)');
      
      this.revenueCatSDK = {
        logIn: async (userId: string) => ({ userId }),
        getProducts: async () => Object.values(REGIONAL_PRODUCTS),
        purchaseProduct: async (productId: string) => ({
          transactionIdentifier: `web_${Date.now()}`,
          productIdentifier: productId,
          purchaseDate: new Date().toISOString()
        }),
        restorePurchases: async () => null,
        getPurchaserInfo: async () => null
      };
    } catch (error) {
      console.error('[RevenueCat] Web initialization failed:', error);
      throw error;
    }
  }

  private async syncUserWithBackend(userId: string): Promise<void> {
    try {
      // Create or update RevenueCat customer record
      const { data: existingCustomer } = await supabase
        .from('revenuecat_customers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingCustomer) {
        const { error } = await supabase
          .from('revenuecat_customers')
          .insert({
            user_id: userId,
            revenuecat_user_id: userId,
            revenuecat_app_user_id: userId
          });

        if (error) {
          console.error('[RevenueCat] Error creating customer:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('[RevenueCat] Backend sync failed:', error);
      throw error;
    }
  }

  async getProducts(): Promise<RevenueCatProduct[]> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      if (window.ReactNativeWebView) {
        // Request products from native
        return new Promise((resolve) => {
          const message = {
            type: 'REVENUECAT_GET_PRODUCTS',
            payload: {}
          };
          
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
          
          // Mock response for now
          setTimeout(() => {
            resolve(Object.values(REGIONAL_PRODUCTS));
          }, 100);
        });
      } else {
        // Web implementation
        return this.revenueCatSDK?.getProducts() || Object.values(REGIONAL_PRODUCTS);
      }
    } catch (error) {
      console.error('[RevenueCat] Error fetching products:', error);
      return Object.values(REGIONAL_PRODUCTS);
    }
  }

  async purchaseProduct(productId: string): Promise<RevenueCatTransaction> {
    if (!this.isInitialized || !this.currentUserId) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      console.log('[RevenueCat] Purchasing product:', productId);
      
      let transaction: RevenueCatTransaction;
      
      if (window.ReactNativeWebView) {
        // Purchase through native
        transaction = await this.purchaseProductNative(productId);
      } else {
        // Purchase through web
        transaction = await this.purchaseProductWeb(productId);
      }

      // Update subscription in backend
      await this.updateSubscriptionAfterPurchase(transaction);
      
      return transaction;
    } catch (error) {
      console.error('[RevenueCat] Purchase failed:', error);
      throw error;
    }
  }

  private async purchaseProductNative(productId: string): Promise<RevenueCatTransaction> {
    return new Promise((resolve, reject) => {
      const message = {
        type: 'REVENUECAT_PURCHASE',
        payload: { productId }
      };
      
      // Set up listener for response
      const handleMessage = (event: any) => {
        const response = JSON.parse(event.data);
        if (response.type === 'REVENUECAT_PURCHASE_RESULT') {
          window.removeEventListener('message', handleMessage);
          if (response.success) {
            resolve(response.transaction);
          } else {
            reject(new Error(response.error));
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
      
      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Purchase timeout'));
      }, 30000);
    });
  }

  private async purchaseProductWeb(productId: string): Promise<RevenueCatTransaction> {
    // Mock purchase for web
    return {
      transactionIdentifier: `trial_${Date.now()}`,
      productIdentifier: productId,
      purchaseDate: new Date().toISOString()
    };
  }

  private async updateSubscriptionAfterPurchase(transaction: RevenueCatTransaction): Promise<void> {
    try {
      const product = REGIONAL_PRODUCTS[transaction.productIdentifier];
      if (!product) return;

      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 7);

      const { data: customer } = await supabase
        .from('revenuecat_customers')
        .select('id')
        .eq('user_id', this.currentUserId)
        .single();

      if (customer) {
        // Create subscription record
        const { error: subscriptionError } = await supabase
          .from('revenuecat_subscriptions')
          .insert({
            customer_id: customer.id,
            revenuecat_subscription_id: transaction.transactionIdentifier,
            product_id: transaction.productIdentifier,
            status: 'in_trial',
            period_type: 'trial',
            purchase_date: transaction.purchaseDate,
            original_purchase_date: transaction.purchaseDate,
            expires_date: trialExpiresAt.toISOString(),
            is_sandbox: REVENUECAT_CONFIG.ENVIRONMENT === 'SANDBOX',
            auto_renew_status: true,
            price_in_purchased_currency: 0,
            currency: product.currencyCode
          });

        if (subscriptionError) throw subscriptionError;

        // Update user profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_premium: true,
            trial_ends_at: trialExpiresAt.toISOString(),
            subscription_status: 'trial',
            subscription_tier: 'premium',
            updated_at: new Date().toISOString()
          })
          .eq('id', this.currentUserId);

        if (profileError) {
          console.error('[RevenueCat] Profile update error:', profileError);
        }
      }
    } catch (error) {
      console.error('[RevenueCat] Subscription update failed:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<RevenueCatPurchaserInfo | null> {
    if (!this.isInitialized || !this.currentUserId) {
      return null;
    }

    try {
      // Fetch from backend
      const { data: subscriptions } = await supabase
        .from('revenuecat_subscriptions')
        .select(`
          *,
          revenuecat_customers!inner (user_id, revenuecat_user_id)
        `)
        .eq('revenuecat_customers.user_id', this.currentUserId);

      if (!subscriptions?.length) return null;

      // Convert to RevenueCat format
      const activeSubscriptions: string[] = [];
      const allExpirationDates: { [productId: string]: string } = {};
      const entitlements: { [entitlementId: string]: RevenueCatEntitlement } = {};

      subscriptions.forEach(sub => {
        if (sub.status === 'active' || sub.status === 'in_trial') {
          activeSubscriptions.push(sub.product_id);
        }
        
        if (sub.expires_date) {
          allExpirationDates[sub.product_id] = sub.expires_date;
        }

        // Map to premium access entitlement
        entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS] = {
          identifier: REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS,
          isActive: sub.status === 'active' || sub.status === 'in_trial',
          willRenew: sub.auto_renew_status || false,
          periodType: sub.period_type === 'trial' ? 'TRIAL' : 'NORMAL',
          latestPurchaseDate: sub.purchase_date || sub.created_at,
          originalPurchaseDate: sub.original_purchase_date || sub.created_at,
          expirationDate: sub.expires_date || undefined,
          store: 'play_store',
          productIdentifier: sub.product_id,
          isSandbox: sub.is_sandbox || false,
          unsubscribeDetectedAt: sub.unsubscribe_detected_at || undefined,
          billingIssueDetectedAt: sub.billing_issues_detected_at || undefined
        };
      });

      return {
        originalAppUserId: this.currentUserId,
        allPurchasedProductIdentifiers: subscriptions.map(sub => sub.product_id),
        latestExpirationDate: Math.max(...Object.values(allExpirationDates).map(date => new Date(date).getTime())).toString(),
        activeSubscriptions,
        allExpirationDates,
        entitlements: {
          all: entitlements,
          active: Object.fromEntries(
            Object.entries(entitlements).filter(([_, ent]) => ent.isActive)
          )
        }
      };
    } catch (error) {
      console.error('[RevenueCat] Restore failed:', error);
      return null;
    }
  }

  async getPurchaserInfo(): Promise<RevenueCatPurchaserInfo | null> {
    return this.restorePurchases();
  }

  async checkTrialEligibility(productId: string): Promise<boolean> {
    if (!this.currentUserId) return false;

    try {
      const { data: previousTrials } = await supabase
        .from('revenuecat_subscriptions')
        .select(`
          *,
          revenuecat_customers!inner (user_id)
        `)
        .eq('revenuecat_customers.user_id', this.currentUserId)
        .eq('product_id', productId)
        .eq('period_type', 'trial');

      return !previousTrials?.length;
    } catch (error) {
      console.error('[RevenueCat] Trial eligibility check failed:', error);
      return false;
    }
  }

  isUserPremium(purchaserInfo: RevenueCatPurchaserInfo | null): boolean {
    if (!purchaserInfo) return false;
    
    const premiumEntitlement = purchaserInfo.entitlements.active[REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS];
    return premiumEntitlement?.isActive || false;
  }

  getTrialEndDate(purchaserInfo: RevenueCatPurchaserInfo | null): Date | null {
    if (!purchaserInfo) return null;

    const premiumEntitlement = purchaserInfo.entitlements.active[REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS];
    
    if (premiumEntitlement?.periodType === 'TRIAL' && premiumEntitlement.expirationDate) {
      return new Date(premiumEntitlement.expirationDate);
    }

    return null;
  }
}

export const revenueCatService = new RevenueCatService();
