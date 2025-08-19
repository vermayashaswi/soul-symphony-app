import { supabase } from '@/integrations/supabase/client';
import { Purchases, LOG_LEVEL, INTRO_ELIGIBILITY_STATUS } from '@revenuecat/purchases-capacitor';

export interface RevenueCatProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  priceString: string;
  currencyCode: string;
  subscriptionPeriod?: string;
  introPrice?: {
    price: number;
    priceString: string;
    period: string;
    cycles: number;
    periodUnit: string;
  };
}

export interface RevenueCatPurchaserInfo {
  originalPurchaseDate: string;
  latestExpirationDate: string | null;
  activeSubscriptions: string[];
  allPurchasedProductIds: string[];
  nonSubscriptionPurchases: any[];
  entitlements: { [key: string]: RevenueCatEntitlement };
}

export interface RevenueCatEntitlement {
  identifier: string;
  productIdentifier: string;
  purchaseDate: string;
  originalPurchaseDate: string;
  expirationDate: string | null;
  store: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: 'trial' | 'normal' | 'intro';
  latestPurchaseDate: string;
  isSandbox: boolean;
  unsubscribeDetectedAt: string | null;
  billingIssueDetectedAt: string | null;
}

export interface RevenueCatTransaction {
  transactionId: string;
  productId: string;
  purchaseDate: string;
  originalTransactionId: string;
  isTrialPeriod: boolean;
  isIntroOfferPeriod: boolean;
}

// Regional product configurations
const REGIONAL_PRODUCTS: Record<string, RevenueCatProduct> = {
  'premium_monthly_in': {
    identifier: 'premium_monthly_in',
    description: 'Premium features with 2-week free trial',
    title: 'Soulo Premium Monthly (India)',
    price: 99,
    priceString: '₹99',
    currencyCode: 'INR'
  },
  'premium_monthly_us': {
    identifier: 'premium_monthly_us',
    description: 'Premium features with 2-week free trial',
    title: 'Soulo Premium Monthly (US)',
    price: 4.99,
    priceString: '$4.99',
    currencyCode: 'USD'
  },
  'premium_monthly_gb': {
    identifier: 'premium_monthly_gb',
    description: 'Premium features with 2-week free trial',
    title: 'Soulo Premium Monthly (UK)',
    price: 3.99,
    priceString: '£3.99',
    currencyCode: 'GBP'
  },
  'premium_monthly_default': {
    identifier: 'premium_monthly_default',
    description: 'Premium features with 2-week free trial',
    title: 'Soulo Premium Monthly',
    price: 4.99,
    priceString: '$4.99',
    currencyCode: 'USD'
  }
};

class RevenueCatService {
  private isInitialized = false;
  private currentUserId: string | null = null;

  // Initialize RevenueCat SDK for the user
  async initialize(userId: string): Promise<void> {
    console.log('RevenueCat: Initializing for user', userId);
    
    try {
      // Configure RevenueCat SDK
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        throw new Error('RevenueCat API key not configured');
      }

      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      await Purchases.configure({ apiKey, appUserID: userId });
      
      this.isInitialized = true;
      this.currentUserId = userId;
      
      console.log('RevenueCat: Native SDK initialized for user', userId);
      
      // Sync with our backend
      await this.syncWithBackend(userId);
    } catch (error) {
      console.error('RevenueCat: Initialization failed', error);
      // Fallback to local logic for development
      await this.initializeLocal(userId);
      this.isInitialized = true;
      this.currentUserId = userId;
    }
  }

  private async getApiKey(): Promise<string> {
    // Get API key from Supabase edge function
    try {
      const { data, error } = await supabase.functions.invoke('revenuecat-init', {
        body: { 
          userId: this.currentUserId,
          platform: this.getCurrentPlatform(),
          getApiKeyOnly: true
        }
      });

      if (error) {
        throw error;
      }

      if (data?.apiKey) {
        const platform = this.getCurrentPlatform();
        // Format the API key with platform prefix if needed
        return data.apiKey.startsWith('appl_') || data.apiKey.startsWith('goog_') || data.apiKey.startsWith('web_') 
          ? data.apiKey 
          : `${platform === 'ios' ? 'appl_' : platform === 'android' ? 'goog_' : 'web_'}${data.apiKey}`;
      }

      throw new Error('No API key returned from edge function');
    } catch (error) {
      console.error('Failed to get API key from edge function:', error);
      throw new Error('RevenueCat API key not available');
    }
  }

  private getCurrentPlatform(): string {
    // Detect current platform
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    return 'web';
  }

  private async syncWithBackend(userId: string): Promise<void> {
    try {
      // Try to use the Supabase edge function to sync
      const { data, error } = await supabase.functions.invoke('revenuecat-init', {
        body: { userId, platform: this.getCurrentPlatform() }
      });

      if (error) {
        console.warn('RevenueCat: Backend sync failed', error);
      } else {
        console.log('RevenueCat: Backend sync successful', data);
      }
    } catch (error) {
      console.warn('RevenueCat: Backend sync error', error);
    }
  }

  private async initializeLocal(userId: string): Promise<void> {
    try {
      // Fetch or create customer record
      let { data: customer, error } = await supabase
        .from('revenuecat_customers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Customer doesn't exist, create one
        const { data: newCustomer, error: createError } = await supabase
          .from('revenuecat_customers')
          .insert([{
            user_id: userId,
            revenuecat_user_id: `customer_${userId}`
          }])
          .select()
          .single();

        if (createError) {
          throw createError;
        }
        customer = newCustomer;
      } else if (error) {
        throw error;
      }

      console.log('RevenueCat: Local initialization complete', customer);
    } catch (error) {
      console.error('RevenueCat: Local initialization failed', error);
      throw error;
    }
  }

  // Get available products for purchase
  async getProducts(): Promise<RevenueCatProduct[]> {
    console.log('RevenueCat: Getting products');
    
    try {
      // Try to get products from RevenueCat SDK
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        // Convert RevenueCat packages to our format
        return offerings.current.availablePackages.map(pkg => ({
          identifier: pkg.identifier,
          title: pkg.product?.title || pkg.identifier,
          description: pkg.product?.description || 'Premium subscription',
          priceString: pkg.product?.priceString || '$4.99',
          price: pkg.product?.price || 4.99,
          currencyCode: pkg.product?.currencyCode || 'USD',
          subscriptionPeriod: pkg.product?.subscriptionPeriod
        }));
      }
    } catch (error) {
      console.warn('RevenueCat: Failed to get products from SDK, using fallback', error);
    }
    
    // Fallback to regional products
    return Object.values(REGIONAL_PRODUCTS);
  }

  // Purchase a product
  async purchaseProduct(productId: string): Promise<RevenueCatTransaction> {
    console.log('RevenueCat: Purchasing product', productId);

    try {
      // Get the offerings first to find the package
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      
      if (!currentOffering) {
        throw new Error('No current offering available');
      }
      
      // Find the package by identifier
      const packageToPurchase = currentOffering.availablePackages.find(pkg => pkg.identifier === productId);
      
      if (!packageToPurchase) {
        throw new Error(`Package ${productId} not found in current offering`);
      }

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });
      const productIdentifier = productId;

      // Create transaction from purchase result
      const transaction: RevenueCatTransaction = {
        transactionId: customerInfo.originalPurchaseDate || `txn_${Date.now()}`,
        productId: productIdentifier,
        purchaseDate: customerInfo.originalPurchaseDate || new Date().toISOString(),
        originalTransactionId: customerInfo.originalPurchaseDate || `orig_${Date.now()}`,
        isTrialPeriod: this.isTrialPeriod(customerInfo, productIdentifier),
        isIntroOfferPeriod: false // SDK doesn't provide this directly
      };

      // Sync purchase with backend
      await this.syncPurchaseWithBackend(productIdentifier, transaction);

      return transaction;
    } catch (error) {
      console.error('RevenueCat: Purchase failed', error);
      
      // Fallback to edge function for web/testing
      try {
        const { data, error: edgeError } = await supabase.functions.invoke('revenuecat-purchase', {
          body: { 
            userId: this.currentUserId,
            productId,
            platform: this.getCurrentPlatform()
          }
        });

        if (edgeError) {
          throw edgeError;
        }

        return {
          transactionId: data.transactionId || `txn_${Date.now()}`,
          productId,
          purchaseDate: new Date().toISOString(),
          originalTransactionId: data.originalTransactionId || `orig_${Date.now()}`,
          isTrialPeriod: data.isTrialPeriod || false,
          isIntroOfferPeriod: data.isIntroOfferPeriod || false
        };
      } catch (fallbackError) {
        console.error('RevenueCat: Fallback purchase also failed', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  private isTrialPeriod(customerInfo: any, productId: string): boolean {
    // Check if the user is in a trial period for this product
    const entitlements = customerInfo.entitlements?.active || {};
    for (const [key, entitlement] of Object.entries(entitlements)) {
      if (entitlement && typeof entitlement === 'object' && 'productIdentifier' in entitlement) {
        if ((entitlement as any).productIdentifier === productId && (entitlement as any).periodType === 'trial') {
          return true;
        }
      }
    }
    return false;
  }

  private async syncPurchaseWithBackend(productId: string, transaction: RevenueCatTransaction): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('revenuecat-purchase', {
        body: { 
          userId: this.currentUserId,
          productId,
          platform: this.getCurrentPlatform(),
          transactionId: transaction.transactionId,
          isTrialPurchase: transaction.isTrialPeriod
        }
      });

      if (error) {
        console.warn('RevenueCat: Failed to sync purchase with backend', error);
      }
    } catch (error) {
      console.warn('RevenueCat: Backend sync error', error);
    }
  }

  // Restore previous purchases
  async restorePurchases(): Promise<RevenueCatPurchaserInfo | null> {
    console.log('RevenueCat: Restoring purchases');
    
    try {
      // Try to restore through RevenueCat SDK first
      const { customerInfo } = await Purchases.restorePurchases();
      
      if (customerInfo && customerInfo.entitlements) {
        // Convert to our format
        const purchaserInfo: RevenueCatPurchaserInfo = {
          originalPurchaseDate: customerInfo.originalPurchaseDate || new Date().toISOString(),
          latestExpirationDate: customerInfo.latestExpirationDate || null,
          activeSubscriptions: Object.keys(customerInfo.entitlements?.active || {}),
          allPurchasedProductIds: Object.keys(customerInfo.entitlements?.all || {}),
          nonSubscriptionPurchases: [],
          entitlements: this.convertEntitlements(customerInfo.entitlements)
        };

        // Sync with backend
        await this.syncRestoredPurchases(purchaserInfo);
        
        return purchaserInfo;
      }
    } catch (error) {
      console.warn('RevenueCat: SDK restore failed, falling back to database', error);
    }
    
    // Fallback to database query
    try {
      const { data: subscriptions, error } = await supabase
        .from('revenuecat_subscriptions')
        .select('*')
        .eq('status', 'active')
        .gte('expires_date', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('RevenueCat: Error fetching subscriptions', error);
        return null;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log('RevenueCat: No active subscriptions found');
        return null;
      }

      const subscription = subscriptions[0];
      
      return {
        originalPurchaseDate: subscription.created_at,
        latestExpirationDate: subscription.expires_date,
        activeSubscriptions: [subscription.product_id],
        allPurchasedProductIds: [subscription.product_id],
        nonSubscriptionPurchases: [],
        entitlements: {
          premium: {
            identifier: 'premium',
            productIdentifier: subscription.product_id,
            purchaseDate: subscription.created_at,
            originalPurchaseDate: subscription.created_at,
            expirationDate: subscription.expires_date,
            store: 'app_store',
            isActive: true,
            willRenew: subscription.auto_renew_status || true,
            periodType: 'normal' as const,
            latestPurchaseDate: subscription.created_at,
            isSandbox: false,
            unsubscribeDetectedAt: null,
            billingIssueDetectedAt: null
          }
        }
      };
    } catch (error) {
      console.error('RevenueCat: Restore purchases failed', error);
      return null;
    }
  }

  private convertEntitlements(entitlements: any): { [key: string]: RevenueCatEntitlement } {
    const converted: { [key: string]: RevenueCatEntitlement } = {};
    
    if (entitlements && typeof entitlements === 'object') {
      Object.entries(entitlements).forEach(([key, entitlement]: [string, any]) => {
        if (entitlement && typeof entitlement === 'object') {
          converted[key] = {
            identifier: entitlement.identifier || key,
            productIdentifier: entitlement.productIdentifier || '',
            purchaseDate: entitlement.purchaseDate || new Date().toISOString(),
            originalPurchaseDate: entitlement.originalPurchaseDate || new Date().toISOString(),
            expirationDate: entitlement.expirationDate || null,
            store: entitlement.store || 'app_store',
            isActive: entitlement.isActive || false,
            willRenew: entitlement.willRenew || false,
            periodType: entitlement.periodType || 'normal',
            latestPurchaseDate: entitlement.latestPurchaseDate || new Date().toISOString(),
            isSandbox: entitlement.isSandbox || false,
            unsubscribeDetectedAt: entitlement.unsubscribeDetectedAt || null,
            billingIssueDetectedAt: entitlement.billingIssueDetectedAt || null
          };
        }
      });
    }
    
    return converted;
  }

  private async syncRestoredPurchases(purchaserInfo: RevenueCatPurchaserInfo): Promise<void> {
    try {
      // Sync each active subscription with backend
      for (const productId of purchaserInfo.activeSubscriptions) {
        await supabase.functions.invoke('revenuecat-purchase', {
          body: { 
            userId: this.currentUserId,
            productId,
            platform: this.getCurrentPlatform(),
            isRestore: true
          }
        });
      }
    } catch (error) {
      console.warn('RevenueCat: Failed to sync restored purchases', error);
    }
  }

  // Get current purchaser info (alias for restore)
  async getPurchaserInfo(): Promise<RevenueCatPurchaserInfo | null> {
    return this.restorePurchases();
  }

  // Check if user is eligible for trial
  async checkTrialEligibility(productId: string): Promise<boolean> {
    console.log('RevenueCat: Checking trial eligibility for', productId);
    
    try {
      // Try to check eligibility through RevenueCat SDK
      const { eligibilities } = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [productId] });
      
      if (eligibilities && eligibilities[productId]) {
        const eligibility = eligibilities[productId];
        return eligibility.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
      }
    } catch (error) {
      console.warn('RevenueCat: SDK trial eligibility check failed, falling back to database', error);
    }
    
    // Fallback to database check
    try {
      const { data: subscriptions, error } = await supabase
        .from('revenuecat_subscriptions')
        .select('*')
        .eq('product_id', productId);

      if (error) {
        console.error('RevenueCat: Error checking trial eligibility', error);
        return true; // Default to eligible if we can't check
      }

      // If user has any subscription with a trial for this product, they're not eligible
      return !subscriptions || subscriptions.length === 0;
    } catch (error) {
      console.error('RevenueCat: Trial eligibility check failed', error);
      return true; // Default to eligible
    }
  }

  // Helper methods
  isUserPremium(purchaserInfo: RevenueCatPurchaserInfo | null): boolean {
    if (!purchaserInfo) return false;
    
    const activeEntitlements = Object.values(purchaserInfo.entitlements);
    return activeEntitlements.some(entitlement => entitlement.isActive);
  }

  getTrialEndDate(purchaserInfo: RevenueCatPurchaserInfo | null): Date | null {
    if (!purchaserInfo) return null;

    const trialEntitlements = Object.values(purchaserInfo.entitlements).filter(
      ent => ent.periodType === 'trial' && ent.isActive
    );

    if (trialEntitlements.length === 0) return null;

    const latestTrial = trialEntitlements.reduce((latest, current) => {
      const currentExp = new Date(current.expirationDate || 0);
      const latestExp = new Date(latest.expirationDate || 0);
      return currentExp > latestExp ? current : latest;
    });

    return latestTrial.expirationDate ? new Date(latestTrial.expirationDate) : null;
  }
}

export const revenueCatService = new RevenueCatService();