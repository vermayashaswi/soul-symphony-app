
import { Purchases, PurchasesOffering, CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  features: string[];
  isPopular?: boolean;
}

export interface SubscriptionStatus {
  isActive: boolean;
  tier: 'free' | 'premium';
  expirationDate?: Date;
  isInTrial: boolean;
  trialEndsAt?: Date;
}

class RevenueCatService {
  private isInitialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Capacitor.isNativePlatform()) {
        // Use your actual RevenueCat API keys here
        const apiKey = Capacitor.getPlatform() === 'ios' 
          ? 'your_ios_api_key_here' 
          : 'your_android_api_key_here';
        
        await Purchases.configure({ apiKey });
        await Purchases.logIn(userId);
      } else {
        console.log('RevenueCat not available on web platform');
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
    }
  }

  async getOfferings(): Promise<PurchasesOffering[]> {
    try {
      if (!Capacitor.isNativePlatform()) {
        // Return mock data for web development
        return [];
      }

      const offerings = await Purchases.getOfferings();
      return offerings.all ? Object.values(offerings.all) : [];
    } catch (error) {
      console.error('Error getting offerings:', error);
      return [];
    }
  }

  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<CustomerInfo | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        // Mock successful purchase for web development
        return this.getMockCustomerInfo(true);
      }

      const purchaseResult = await Purchases.purchasePackage({ aPackage: packageToPurchase });
      await this.syncSubscriptionWithDatabase(purchaseResult.customerInfo);
      return purchaseResult.customerInfo;
    } catch (error) {
      console.error('Error purchasing package:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        // Return mock data for web development
        return this.getMockCustomerInfo(false);
      }

      const customerInfo = await Purchases.getCustomerInfo();
      await this.syncSubscriptionWithDatabase(customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('Error getting customer info:', error);
      return null;
    }
  }

  async restorePurchases(): Promise<CustomerInfo | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return this.getMockCustomerInfo(false);
      }

      const customerInfo = await Purchases.restorePurchases();
      await this.syncSubscriptionWithDatabase(customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return null;
    }
  }

  private async syncSubscriptionWithDatabase(customerInfo: CustomerInfo): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isActive = Object.keys(customerInfo.entitlements.active).length > 0;
      const activeEntitlement = Object.values(customerInfo.entitlements.active)[0];
      
      const subscriptionData = {
        is_premium: isActive,
        subscription_tier: isActive ? 'premium' : 'free',
        trial_ends_at: activeEntitlement?.willRenew === false 
          ? new Date(activeEntitlement.expirationDate || Date.now()).toISOString()
          : null,
        updated_at: new Date().toISOString()
      };

      await supabase
        .from('profiles')
        .update(subscriptionData)
        .eq('id', user.id);

      // Store transaction info
      if (customerInfo.latestExpirationDate) {
        await supabase
          .from('subscription_transactions')
          .upsert({
            user_id: user.id,
            transaction_id: customerInfo.originalPurchaseDate || 'unknown',
            product_id: activeEntitlement?.productIdentifier || 'premium',
            purchase_date: new Date().toISOString(),
            expiration_date: new Date(customerInfo.latestExpirationDate).toISOString(),
            is_trial_period: activeEntitlement?.isInIntroOfferPeriod || false,
            store: 'app_store'
          });
      }
    } catch (error) {
      console.error('Error syncing subscription with database:', error);
    }
  }

  private getMockCustomerInfo(isActive: boolean): CustomerInfo {
    return {
      entitlements: {
        active: isActive ? { premium: {} as any } : {},
        all: {}
      },
      activeSubscriptions: isActive ? ['premium'] : [],
      latestExpirationDate: isActive ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      originalPurchaseDate: isActive ? new Date().toISOString() : null
    } as CustomerInfo;
  }

  getSubscriptionTiers(): SubscriptionTier[] {
    return [
      {
        id: 'premium_monthly',
        name: 'Premium Monthly',
        price: '$9.99/month',
        features: [
          'Unlimited journal entries',
          'Advanced AI insights',
          'Voice recording',
          'Export capabilities',
          'Priority support'
        ]
      },
      {
        id: 'premium_yearly',
        name: 'Premium Yearly',
        price: '$99.99/year',
        features: [
          'Unlimited journal entries',
          'Advanced AI insights',
          'Voice recording',
          'Export capabilities',
          'Priority support',
          'Save 17% vs monthly'
        ],
        isPopular: true
      }
    ];
  }
}

export const revenueCatService = new RevenueCatService();
