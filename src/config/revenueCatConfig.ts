
/**
 * RevenueCat Configuration for SOULo
 * Contains API keys, product identifiers, and entitlement mappings
 */

export const REVENUECAT_CONFIG = {
  // API Keys
  API_KEY: 'sk_NfOwnoNhgrhRULQuAwCdWpclLFDev',
  
  // Entitlements
  ENTITLEMENTS: {
    PREMIUM_ACCESS: 'entl9730aa8da2'
  },
  
  // Product Identifiers by Region
  PRODUCTS: {
    PREMIUM_MONTHLY_US: 'premium_monthly_us',
    PREMIUM_MONTHLY_IN: 'premium_monthly_in', 
    PREMIUM_MONTHLY_GB: 'premium_monthly_gb',
    PREMIUM_MONTHLY_DEFAULT: 'premium_monthly_default'
  },
  
  // Webhook Configuration
  WEBHOOK: {
    URL: process.env.NODE_ENV === 'production' 
      ? 'https://your-project.supabase.co/functions/v1/revenuecat-webhook'
      : 'http://localhost:54321/functions/v1/revenuecat-webhook'
  },
  
  // Environment Settings
  ENVIRONMENT: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX'
} as const;

// Type definitions for better TypeScript support
export type ProductIdentifier = typeof REVENUECAT_CONFIG.PRODUCTS[keyof typeof REVENUECAT_CONFIG.PRODUCTS];
export type EntitlementIdentifier = typeof REVENUECAT_CONFIG.ENTITLEMENTS[keyof typeof REVENUECAT_CONFIG.ENTITLEMENTS];
