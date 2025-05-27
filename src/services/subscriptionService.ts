
import Purchases, { PurchasesOffering, CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-js';
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

  async getOfferings(): Promise<PurchasesOffering[]> {
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

  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<CustomerInfo> {
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
          purchase_date: latestTransaction || new Date().toISOString(),
          expiration_date: expirationDate,
          is_trial_period: premiumEntitlement.isIntroPeriod || false
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
          trial_ends_at: premiumEntitlement?.isIntroPeriod ? premiumEntitlement.expirationDate : null
        })
        .eq('id', user.id);

    } catch (error) {
      console.error('Failed to sync subscription status:', error);
    }
  }

  private isExpired(expirationDate: string | null): boolean {
    if (!expirationDate) return true;
    return new Date(expirationDate) <= new Date();
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

    const expiresAt = premiumEntitlement.expirationDate ? new Date(premiumEntitlement.expirationDate) : null;
    const isExpired = this.isExpired(premiumEntitlement.expirationDate);
    const isTrialActive = premiumEntitlement.isIntroPeriod && !isExpired;

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
