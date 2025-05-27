
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Mock types for development when RevenueCat is not available
interface MockPurchasesOffering {
  identifier: string;
  availablePackages: MockPurchasesPackage[];
}

interface MockPurchasesPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    price: string;
    title: string;
  };
}

interface MockCustomerInfo {
  entitlements: {
    active: Record<string, any>;
    all: Record<string, any>;
  };
  activeSubscriptions: string[];
  latestExpirationDate: string | null;
  originalPurchaseDate: string | null;
}

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
        // RevenueCat would be imported and used here in a real mobile app
        console.log('RevenueCat would be initialized here for user:', userId);
      } else {
        console.log('RevenueCat not available on web platform');
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
    }
  }

  async getOfferings(): Promise<MockPurchasesOffering[]> {
    try {
      if (!Capacitor.isNativePlatform()) {
        // Return mock data for web development
        return [];
      }

      // In a real implementation, this would use the actual RevenueCat SDK
      return [];
    } catch (error) {
      console.error('Error getting offerings:', error);
      return [];
    }
  }

  async purchasePackage(packageToPurchase: MockPurchasesPackage): Promise<MockCustomerInfo | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        // Mock successful purchase for web development
        return this.getMockCustomerInfo(true);
      }

      // In a real implementation, this would use the actual RevenueCat SDK
      const mockCustomerInfo = this.getMockCustomerInfo(true);
      await this.syncSubscriptionWithDatabase(mockCustomerInfo);
      return mockCustomerInfo;
    } catch (error) {
      console.error('Error purchasing package:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<MockCustomerInfo | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        // Return mock data for web development
        return this.getMockCustomerInfo(false);
      }

      // In a real implementation, this would use the actual RevenueCat SDK
      const mockCustomerInfo = this.getMockCustomerInfo(false);
      await this.syncSubscriptionWithDatabase(mockCustomerInfo);
      return mockCustomerInfo;
    } catch (error) {
      console.error('Error getting customer info:', error);
      return null;
    }
  }

  async restorePurchases(): Promise<MockCustomerInfo | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return this.getMockCustomerInfo(false);
      }

      // In a real implementation, this would use the actual RevenueCat SDK
      const mockCustomerInfo = this.getMockCustomerInfo(false);
      await this.syncSubscriptionWithDatabase(mockCustomerInfo);
      return mockCustomerInfo;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return null;
    }
  }

  private async syncSubscriptionWithDatabase(customerInfo: MockCustomerInfo): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isActive = Object.keys(customerInfo.entitlements.active).length > 0;
      const activeEntitlement = Object.values(customerInfo.entitlements.active)[0];
      
      const subscriptionData = {
        is_premium: isActive,
        subscription_tier: isActive ? 'premium' as const : 'free' as const,
        trial_ends_at: activeEntitlement && typeof activeEntitlement === 'object' && 'willRenew' in activeEntitlement && activeEntitlement.willRenew === false 
          ? new Date(activeEntitlement.expirationDate as string || Date.now()).toISOString()
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
            product_id: activeEntitlement && typeof activeEntitlement === 'object' && 'productIdentifier' in activeEntitlement 
              ? activeEntitlement.productIdentifier as string 
              : 'premium',
            purchase_date: new Date().toISOString(),
            expiration_date: new Date(customerInfo.latestExpirationDate).toISOString(),
            is_trial_period: activeEntitlement && typeof activeEntitlement === 'object' && 'isInIntroOfferPeriod' in activeEntitlement 
              ? activeEntitlement.isInIntroOfferPeriod as boolean 
              : false,
            store: 'app_store'
          });
      }
    } catch (error) {
      console.error('Error syncing subscription with database:', error);
    }
  }

  private getMockCustomerInfo(isActive: boolean): MockCustomerInfo {
    return {
      entitlements: {
        active: isActive ? { premium: { willRenew: true, expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), productIdentifier: 'premium', isInIntroOfferPeriod: false } } : {},
        all: {}
      },
      activeSubscriptions: isActive ? ['premium'] : [],
      latestExpirationDate: isActive ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      originalPurchaseDate: isActive ? new Date().toISOString() : null
    };
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
