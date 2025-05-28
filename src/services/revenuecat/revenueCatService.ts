
import { locationPricingService } from '@/services/pricing/locationPricing';

export interface RevenueCatProduct {
  identifier: string;
  description: string;
  title: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  subscriptionPeriod?: string;
}

export interface RevenueCatPurchaserInfo {
  originalAppUserId: string;
  allPurchaseDates: { [key: string]: string };
  allExpirationDates: { [key: string]: string };
  activeSubscriptions: string[];
  entitlements: { [key: string]: RevenueCatEntitlement };
  nonSubscriptionTransactions: RevenueCatTransaction[];
  managementURL?: string;
}

export interface RevenueCatEntitlement {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: string;
  latestPurchaseDate: string;
  originalPurchaseDate: string;
  expirationDate?: string;
  store: string;
  productIdentifier: string;
  isSandbox: boolean;
}

export interface RevenueCatTransaction {
  transactionIdentifier: string;
  productIdentifier: string;
  purchaseDate: string;
}

class RevenueCatService {
  private isInitialized = false;
  private userId: string | null = null;

  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    this.isInitialized = true;
    console.log('RevenueCat initialized for user:', userId);
  }

  async getProducts(): Promise<RevenueCatProduct[]> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    try {
      // Get location-based pricing
      const pricing = await locationPricingService.getPricingForUser();
      
      // Mock products with location-based pricing
      const products: RevenueCatProduct[] = [
        {
          identifier: 'soulo_premium_monthly',
          title: 'SOuLO Premium Monthly',
          description: 'Monthly subscription to SOuLO Premium features',
          price: locationPricingService.formatPrice(pricing.monthly, pricing.currency, pricing.currencySymbol),
          priceAmountMicros: pricing.monthly * 10000, // Convert to micros
          priceCurrencyCode: pricing.currency,
          subscriptionPeriod: 'P1M'
        },
        {
          identifier: 'soulo_premium_yearly',
          title: 'SOuLO Premium Yearly',
          description: 'Yearly subscription to SOuLO Premium features',
          price: locationPricingService.formatPrice(pricing.yearly, pricing.currency, pricing.currencySymbol),
          priceAmountMicros: pricing.yearly * 10000, // Convert to micros
          priceCurrencyCode: pricing.currency,
          subscriptionPeriod: 'P1Y'
        }
      ];

      return products;
    } catch (error) {
      console.error('Failed to get products:', error);
      return [];
    }
  }

  async getPurchaserInfo(): Promise<RevenueCatPurchaserInfo | null> {
    if (!this.isInitialized || !this.userId) {
      throw new Error('RevenueCat not initialized');
    }

    // Mock purchaser info - in real implementation this would call RevenueCat SDK
    return {
      originalAppUserId: this.userId,
      allPurchaseDates: {},
      allExpirationDates: {},
      activeSubscriptions: [],
      entitlements: {},
      nonSubscriptionTransactions: []
    };
  }

  async purchaseProduct(productId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    console.log('Purchasing product:', productId);
    
    // Mock purchase - in real implementation this would call RevenueCat SDK
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate successful purchase
        resolve();
      }, 1000);
    });
  }

  async restorePurchases(): Promise<RevenueCatPurchaserInfo | null> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    console.log('Restoring purchases');
    return await this.getPurchaserInfo();
  }

  async checkTrialEligibility(productId: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    // Mock trial eligibility check
    return true;
  }

  isUserPremium(purchaserInfo: RevenueCatPurchaserInfo | null): boolean {
    if (!purchaserInfo) return false;
    
    return purchaserInfo.activeSubscriptions.length > 0 ||
           Object.values(purchaserInfo.entitlements).some(entitlement => entitlement.isActive);
  }

  getTrialEndDate(purchaserInfo: RevenueCatPurchaserInfo | null): Date | null {
    if (!purchaserInfo) return null;

    // Check for active trial entitlements
    const trialEntitlement = Object.values(purchaserInfo.entitlements).find(
      entitlement => entitlement.isActive && entitlement.expirationDate
    );

    if (trialEntitlement?.expirationDate) {
      return new Date(trialEntitlement.expirationDate);
    }

    return null;
  }
}

export const revenueCatService = new RevenueCatService();
