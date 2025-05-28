
import { supabase } from '@/integrations/supabase/client';

export interface RevenueCatProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  priceString: string;
  currencyCode: string;
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

class RevenueCatService {
  private isInitialized = false;
  private currentUserId: string | null = null;

  async initialize(userId: string): Promise<void> {
    try {
      console.log('Initializing RevenueCat for user:', userId);
      
      // In a real implementation, you would configure the RevenueCat SDK here
      // For now, we'll simulate the initialization
      this.currentUserId = userId;
      this.isInitialized = true;
      
      // Create or update RevenueCat customer record
      await this.createOrUpdateCustomer(userId);
      
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
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
          console.error('Error creating RevenueCat customer:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in createOrUpdateCustomer:', error);
      throw error;
    }
  }

  async getProducts(): Promise<RevenueCatProduct[]> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    // In a real implementation, this would fetch from RevenueCat SDK
    // For now, return a mock product for the 7-day trial
    return [
      {
        identifier: 'soulo_premium_monthly',
        description: 'Premium features with 7-day free trial',
        title: 'Soulo Premium Monthly',
        price: 9.99,
        priceString: '$9.99',
        currencyCode: 'USD',
        introPrice: {
          price: 0,
          priceString: 'Free',
          period: 'P1W', // 1 week
          cycles: 1,
          periodUnit: 'week'
        }
      }
    ];
  }

  async purchaseProduct(productId: string): Promise<RevenueCatTransaction> {
    if (!this.isInitialized || !this.currentUserId) {
      throw new Error('RevenueCat not initialized or user not set');
    }

    try {
      console.log('Attempting to purchase product:', productId);
      
      // In a real implementation, this would trigger the RevenueCat purchase flow
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
        await supabase
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
            currency: 'USD'
          });
      }

      return transaction;
    } catch (error) {
      console.error('Error purchasing product:', error);
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
          store: 'app_store', // or 'play_store' depending on platform
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
      console.error('Error restoring purchases:', error);
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
      console.error('Error checking trial eligibility:', error);
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
