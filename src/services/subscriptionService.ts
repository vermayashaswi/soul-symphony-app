
import { Purchases, Offering, Package, CustomerInfo, EntitlementInfo } from '@revenuecat/purchases-js';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionStatus {
  isActive: boolean;
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  productId: string | null;
}

class SubscriptionService {
  private initialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize RevenueCat with your public API key
      // You'll need to add this as a secret in Supabase
      const publicKey = 'your_revenuecat_public_key'; // This will be configured via secrets
      
      await Purchases.configure({
        apiKey: publicKey,
        appUserId: userId
      });

      this.initialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  async getOfferings(): Promise<Offering[]> {
    try {
      const offerings = await Purchases.getOfferings();
      return Object.values(offerings.all);
    } catch (error) {
      console.error('Failed to get offerings:', error);
      return [];
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('Failed to get customer info:', error);
      return null;
    }
  }

  async purchasePackage(packageToPurchase: Package): Promise<CustomerInfo> {
    try {
      const purchaseResult = await Purchases.purchasePackage(packageToPurchase);
      
      // Sync with our database
      await this.syncSubscriptionStatus(purchaseResult.customerInfo);
      
      return purchaseResult.customerInfo;
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      await this.syncSubscriptionStatus(customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('Restore purchases failed:', error);
      throw error;
    }
  }

  private async syncSubscriptionStatus(customerInfo: CustomerInfo): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get active entitlements
      const activeEntitlements = customerInfo.entitlements.active;
      const premiumEntitlement = activeEntitlements['premium'] || activeEntitlements['pro'];
      
      let subscriptionData = {
        user_id: user.id,
        transaction_id: '',
        product_id: '',
        purchase_date: new Date().toISOString(),
        expiration_date: null as string | null,
        is_trial_period: false,
        store: 'revenuecat',
        currency: 'USD',
        price: 0,
        updated_at: new Date().toISOString()
      };

      if (premiumEntitlement) {
        const latestTransaction = premiumEntitlement.latestPurchaseDate;
        const expirationDate = premiumEntitlement.expirationDate;
        
        subscriptionData = {
          ...subscriptionData,
          transaction_id: premiumEntitlement.productIdentifier,
          product_id: premiumEntitlement.productIdentifier,
          purchase_date: latestTransaction ? (typeof latestTransaction === 'string' ? latestTransaction : latestTransaction.toISOString()) : new Date().toISOString(),
          expiration_date: expirationDate ? (typeof expirationDate === 'string' ? expirationDate : expirationDate.toISOString()) : null,
          is_trial_period: this.isTrialPeriod(premiumEntitlement)
        };
      }

      // Update our subscription_transactions table
      const { error } = await supabase
        .from('subscription_transactions')
        .upsert(subscriptionData, {
          onConflict: 'user_id,transaction_id'
        });

      if (error) {
        console.error('Failed to sync subscription status:', error);
      }

      // Update profile premium status
      const isPremium = !!premiumEntitlement && !this.isExpired(premiumEntitlement.expirationDate);
      
      await supabase
        .from('profiles')
        .update({
          is_premium: isPremium,
          subscription_tier: isPremium ? 'premium' : 'free',
          trial_ends_at: this.isTrialPeriod(premiumEntitlement) ? (premiumEntitlement.expirationDate ? (typeof premiumEntitlement.expirationDate === 'string' ? premiumEntitlement.expirationDate : premiumEntitlement.expirationDate.toISOString()) : null) : null
        })
        .eq('id', user.id);

    } catch (error) {
      console.error('Failed to sync subscription status:', error);
    }
  }

  private isExpired(expirationDate: string | Date | null): boolean {
    if (!expirationDate) return true;
    const expDate = typeof expirationDate === 'string' ? new Date(expirationDate) : expirationDate;
    return expDate <= new Date();
  }

  private isTrialPeriod(entitlement: EntitlementInfo | null): boolean {
    if (!entitlement) return false;
    // Check if this is a trial period - this might vary based on your RevenueCat configuration
    // Common ways to detect trial periods:
    // 1. Check if periodType includes 'trial'
    // 2. Check if there's a specific trial identifier
    // 3. Check purchase date vs current date for trial duration
    
    // For now, we'll use a simple heuristic - if the entitlement is active and recent
    const now = new Date();
    const purchaseDate = entitlement.latestPurchaseDate;
    
    if (!purchaseDate) return false;
    
    const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
    const daysSincePurchase = (now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24);
    
    // Assume it's a trial if it's been less than 7 days since purchase
    // You should adjust this logic based on your actual trial configuration
    return daysSincePurchase <= 7;
  }

  getSubscriptionStatus(customerInfo: CustomerInfo | null): SubscriptionStatus {
    if (!customerInfo) {
      return {
        isActive: false,
        isTrialActive: false,
        trialEndsAt: null,
        expiresAt: null,
        productId: null
      };
    }

    const activeEntitlements = customerInfo.entitlements.active;
    const premiumEntitlement = activeEntitlements['premium'] || activeEntitlements['pro'];

    if (!premiumEntitlement) {
      return {
        isActive: false,
        isTrialActive: false,
        trialEndsAt: null,
        expiresAt: null,
        productId: null
      };
    }

    const expiresAt = premiumEntitlement.expirationDate ? 
      (typeof premiumEntitlement.expirationDate === 'string' ? 
        new Date(premiumEntitlement.expirationDate) : 
        premiumEntitlement.expirationDate) : null;
    
    const isExpired = this.isExpired(premiumEntitlement.expirationDate);
    const isTrialActive = this.isTrialPeriod(premiumEntitlement) && !isExpired;

    return {
      isActive: !isExpired,
      isTrialActive,
      trialEndsAt: isTrialActive ? expiresAt : null,
      expiresAt,
      productId: premiumEntitlement.productIdentifier
    };
  }
}

export const subscriptionService = new SubscriptionService();
