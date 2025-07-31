
import { supabase } from '@/integrations/supabase/client';

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

// Regional product configurations for Google Play
const REGIONAL_PRODUCTS: Record<string, RevenueCatProduct> = {
  'premium_monthly_in': {
    identifier: 'premium_monthly_in',
    description: 'Premium features with 7-day free trial',
    title: 'Soulo Premium Monthly (India)',
    price: 99,
    priceString: '₹99',
    currencyCode: 'INR',
    region: 'India'
  },
  'premium_monthly_us': {
    identifier: 'premium_monthly_us',
    description: 'Premium features with 7-day free trial',
    title: 'Soulo Premium Monthly (US)',
    price: 4.99,
    priceString: '$4.99',
    currencyCode: 'USD',
    region: 'United States'
  },
  'premium_monthly_gb': {
    identifier: 'premium_monthly_gb',
    description: 'Premium features with 7-day free trial',
    title: 'Soulo Premium Monthly (UK)',
    price: 3.99,
    priceString: '£3.99',
    currencyCode: 'GBP',
    region: 'United Kingdom'
  },
  'premium_monthly_default': {
    identifier: 'premium_monthly_default',
    description: 'Premium features with 7-day free trial',
    title: 'Soulo Premium Monthly',
    price: 4.99,
    priceString: '$4.99',
    currencyCode: 'USD',
    region: 'Global'
  }
};

class RevenueCatService {
  private isInitialized = false;
  private currentUserId: string | null = null;
  private initializationAttempts = 0;
  private maxInitializationAttempts = 3;

  async initialize(userId: string): Promise<void> {
    try {
      console.log('[RevenueCatService] Initializing RevenueCat for user:', userId);
      
      // Reset attempts for new user
      if (this.currentUserId !== userId) {
        this.initializationAttempts = 0;
      }
      
      this.initializationAttempts++;
      
      if (this.initializationAttempts > this.maxInitializationAttempts) {
        console.warn('[RevenueCatService] Max initialization attempts reached, using fallback mode');
        this.isInitialized = true;
        this.currentUserId = userId;
        return;
      }
      
      this.currentUserId = userId;
      
      // Call the edge function for initialization
      const platform = this.detectPlatform();
      
      try {
        const { data, error } = await supabase.functions.invoke('revenuecat-init', {
          body: {
            userId,
            platform
          }
        });

        if (error) {
          console.error('[RevenueCatService] Edge function error:', error);
          throw error;
        }

        if (!data.success) {
          throw new Error(data.error || 'Failed to initialize RevenueCat');
        }

        console.log('[RevenueCatService] Edge function initialization successful');
      } catch (edgeError) {
        console.warn('[RevenueCatService] Edge function failed, falling back to local initialization:', edgeError);
        
        // Fallback to local initialization
        await Promise.race([
          this.createOrUpdateCustomer(userId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Customer creation timeout')), 5000)
          )
        ]);
      }
      
      this.isInitialized = true;
      console.log('[RevenueCatService] RevenueCat initialized successfully');
    } catch (error) {
      console.error('[RevenueCatService] Failed to initialize RevenueCat:', error);
      
      // Still mark as initialized in fallback mode to prevent blocking the app
      this.isInitialized = true;
      this.currentUserId = userId;
      
      // Only throw if this is a critical error and we're not in fallback mode
      if (this.initializationAttempts <= 1) {
        throw error;
      }
    }
  }

  private detectPlatform(): 'ios' | 'android' {
    // For web version, default to android for testing
    // In actual mobile app, this would detect the real platform
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'ios';
    }
    return 'android';
  }

  private async createOrUpdateCustomer(userId: string): Promise<void> {
    try {
      console.log('[RevenueCatService] Creating/updating customer for user:', userId);
      
      // Test database connectivity with a simple query first
      const { error: connectivityError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (connectivityError) {
        console.error('[RevenueCatService] Database connectivity test failed:', connectivityError);
        throw new Error(`Database connection failed: ${connectivityError.message}`);
      }

      const { data: existingCustomer, error: fetchError } = await supabase
        .from('revenuecat_customers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('[RevenueCatService] Error fetching existing customer:', fetchError);
        // Don't throw here, just log the error and continue
        return;
      }

      if (!existingCustomer) {
        // Create new customer record
        const { error: insertError } = await supabase
          .from('revenuecat_customers')
          .insert({
            user_id: userId,
            revenuecat_user_id: userId,
            revenuecat_app_user_id: userId
          });

        if (insertError) {
          console.error('[RevenueCatService] Error creating RevenueCat customer:', insertError);
          // Don't throw here to prevent blocking app initialization
          return;
        }
        
        console.log('[RevenueCatService] Customer created successfully');
      } else {
        console.log('[RevenueCatService] Customer already exists');
      }
    } catch (error) {
      console.error('[RevenueCatService] Error in createOrUpdateCustomer:', error);
      // Don't re-throw to prevent blocking app initialization
    }
  }

  async getProducts(): Promise<RevenueCatProduct[]> {
    if (!this.isInitialized) {
      console.warn('[RevenueCatService] Service not initialized, returning empty products');
      return [];
    }

    console.log('[RevenueCatService] Fetching products...');
    
    // Return all regional products for now
    return Object.values(REGIONAL_PRODUCTS);
  }

  async getProductByRegion(region: string): Promise<RevenueCatProduct | null> {
    const products = await this.getProducts();
    return products.find(product => product.region === region) || 
           products.find(product => product.identifier === 'premium_monthly_default') || 
           null;
  }

  async purchaseProduct(productId: string): Promise<RevenueCatTransaction> {
    if (!this.isInitialized || !this.currentUserId) {
      throw new Error('RevenueCat not initialized or user not set');
    }

    try {
      console.log('[RevenueCatService] Attempting to purchase product:', productId);
      
      const platform = this.detectPlatform();
      const isTrialPurchase = productId.includes('trial') || await this.checkTrialEligibility(productId);

      // Try using the edge function first
      try {
        const { data, error } = await supabase.functions.invoke('revenuecat-purchase', {
          body: {
            userId: this.currentUserId,
            productId,
            platform,
            isTrialPurchase
          }
        });

        if (error) {
          console.error('[RevenueCatService] Edge function purchase error:', error);
          throw error;
        }

        if (!data.success) {
          throw new Error(data.error || 'Purchase failed');
        }

        console.log('[RevenueCatService] Edge function purchase successful');
        
        return {
          transactionIdentifier: data.subscription.id,
          productIdentifier: data.subscription.productId,
          purchaseDate: data.subscription.currentPeriodStart
        };

      } catch (edgeError) {
        console.warn('[RevenueCatService] Edge function purchase failed, falling back to local processing:', edgeError);
        
        // Fallback to local processing
        // Validate product exists
        const product = REGIONAL_PRODUCTS[productId];
        if (!product) {
          throw new Error(`Product ${productId} not found`);
        }

        // In a real implementation, this would trigger the Google Play purchase flow
        const transaction: RevenueCatTransaction = {
          transactionIdentifier: `trial_${Date.now()}`,
          productIdentifier: productId,
          purchaseDate: new Date().toISOString()
        };

        // Create subscription record for trial
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + 7); // 7-day trial

        const { data: customer } = await supabase
          .from('revenuecat_customers')
          .select('id')
          .eq('user_id', this.currentUserId)
          .maybeSingle();

        if (customer) {
          const { error: subscriptionError } = await supabase
            .from('revenuecat_subscriptions')
            .insert({
              customer_id: customer.id,
              revenuecat_subscription_id: transaction.transactionIdentifier,
              product_id: productId,
              status: 'in_trial',
              period_type: 'trial',
              purchase_date: transaction.purchaseDate,
              original_purchase_date: transaction.purchaseDate,
              expires_date: trialExpiresAt.toISOString(),
              is_sandbox: true,
              auto_renew_status: true,
              price_in_purchased_currency: 0,
              currency: product.currencyCode
            });

          if (subscriptionError) {
            console.error('[RevenueCatService] Error creating subscription:', subscriptionError);
            throw subscriptionError;
          }

          // Update user profile to reflect premium status
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              is_premium: true,
              trial_ends_at: trialExpiresAt.toISOString(),
              subscription_status: 'trial',
              updated_at: new Date().toISOString()
            })
            .eq('id', this.currentUserId);

          if (profileError) {
            console.error('[RevenueCatService] Error updating profile:', profileError);
            // Don't throw here as the subscription was created successfully
          }
        }

        console.log('[RevenueCatService] Fallback purchase completed successfully:', transaction);
        return transaction;
      }
    } catch (error) {
      console.error('[RevenueCatService] Error purchasing product:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<RevenueCatPurchaserInfo | null> {
    if (!this.isInitialized || !this.currentUserId) {
      console.warn('[RevenueCatService] Service not initialized, cannot restore purchases');
      return null;
    }

    try {
      // Fetch user's subscriptions from our database
      const { data: subscriptions, error } = await supabase
        .from('revenuecat_subscriptions')
        .select(`
          *,
          revenuecat_customers!inner (
            user_id,
            revenuecat_user_id
          )
        `)
        .eq('revenuecat_customers.user_id', this.currentUserId);

      if (error) {
        console.error('[RevenueCatService] Error fetching subscriptions:', error);
        return null;
      }

      if (!subscriptions || subscriptions.length === 0) {
        return null;
      }

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

        entitlements[sub.product_id] = {
          identifier: sub.product_id,
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
      console.error('[RevenueCatService] Error restoring purchases:', error);
      return null;
    }
  }

  async getPurchaserInfo(): Promise<RevenueCatPurchaserInfo | null> {
    return this.restorePurchases();
  }

  async checkTrialEligibility(productId: string): Promise<boolean> {
    if (!this.isInitialized || !this.currentUserId) {
      return false;
    }

    try {
      // Check if user has already used a trial for this product
      const { data: previousTrials, error } = await supabase
        .from('revenuecat_subscriptions')
        .select(`
          *,
          revenuecat_customers!inner (user_id)
        `)
        .eq('revenuecat_customers.user_id', this.currentUserId)
        .eq('product_id', productId)
        .eq('period_type', 'trial');

      if (error) {
        console.error('[RevenueCatService] Error checking trial eligibility:', error);
        return false;
      }

      return !previousTrials || previousTrials.length === 0;
    } catch (error) {
      console.error('[RevenueCatService] Error checking trial eligibility:', error);
      return false;
    }
  }

  isUserPremium(purchaserInfo: RevenueCatPurchaserInfo | null): boolean {
    if (!purchaserInfo) return false;
    
    const activeEntitlements = Object.values(purchaserInfo.entitlements.active);
    return activeEntitlements.some(entitlement => 
      entitlement.isActive && 
      (entitlement.periodType === 'TRIAL' || entitlement.periodType === 'NORMAL')
    );
  }

  getTrialEndDate(purchaserInfo: RevenueCatPurchaserInfo | null): Date | null {
    if (!purchaserInfo) return null;

    const trialEntitlements = Object.values(purchaserInfo.entitlements.active).filter(
      ent => ent.periodType === 'TRIAL' && ent.isActive
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
