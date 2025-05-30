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

  async initialize(userId: string): Promise<void> {
    try {
      console.log('[RevenueCatService] Initializing RevenueCat for user:', userId);
      
      // In a real implementation, you would configure the RevenueCat SDK here
      // For now, we'll simulate the initialization
      this.currentUserId = userId;
      this.isInitialized = true;
      
      // Create or update RevenueCat customer record
      await this.createOrUpdateCustomer(userId);
      
      console.log('[RevenueCatService] RevenueCat initialized successfully');
    } catch (error) {
      console.error('[RevenueCatService] Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  private async createOrUpdateCustomer(userId: string): Promise<void> {
    try {
      const { data: existingCustomer } = await supabase
        .from('revenuecat_customers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!existingCustomer) {
        // Create new customer record
        const { error } = await supabase
          .from('revenuecat_customers')
          .insert({
            user_id: userId,
            revenuecat_user_id: userId, // Using Supabase user ID as RevenueCat user ID
            revenuecat_app_user_id: userId
          });

        if (error) {
          console.error('[RevenueCatService] Error creating RevenueCat customer:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('[RevenueCatService] Error in createOrUpdateCustomer:', error);
      throw error;
    }
  }

  async getProducts(): Promise<RevenueCatProduct[]> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    console.log('[RevenueCatService] Fetching products...');
    
    // Return all regional products for now
    // In a real implementation, this would fetch from Google Play Store
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
      
      // Validate product exists
      const product = REGIONAL_PRODUCTS[productId];
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // In a real implementation, this would trigger the Google Play purchase flow
      // For now, we'll simulate a successful trial subscription
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
        .single();

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
            is_sandbox: true, // Set to false in production
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

      console.log('[RevenueCatService] Purchase completed successfully:', transaction);
      return transaction;
    } catch (error) {
      console.error('[RevenueCatService] Error purchasing product:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<RevenueCatPurchaserInfo | null> {
    if (!this.isInitialized || !this.currentUserId) {
      throw new Error('RevenueCat not initialized or user not set');
    }

    try {
      // Fetch user's subscriptions from our database
      const { data: subscriptions } = await supabase
        .from('revenuecat_subscriptions')
        .select(`
          *,
          revenuecat_customers!inner (
            user_id,
            revenuecat_user_id
          )
        `)
        .eq('revenuecat_customers.user_id', this.currentUserId);

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
      const { data: previousTrials } = await supabase
        .from('revenuecat_subscriptions')
        .select(`
          *,
          revenuecat_customers!inner (user_id)
        `)
        .eq('revenuecat_customers.user_id', this.currentUserId)
        .eq('product_id', productId)
        .eq('period_type', 'trial');

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
