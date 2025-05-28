
export interface PricingTier {
  monthly: number;
  yearly: number;
  currency: string;
  currencySymbol: string;
}

export interface CountryPricing {
  [key: string]: PricingTier;
}

// Pricing table based on location
export const LOCATION_PRICING: CountryPricing = {
  // Tier 1 - High income countries
  US: { monthly: 999, yearly: 9999, currency: 'USD', currencySymbol: '$' },
  CA: { monthly: 1299, yearly: 12999, currency: 'CAD', currencySymbol: 'CA$' },
  GB: { monthly: 799, yearly: 7999, currency: 'GBP', currencySymbol: '£' },
  AU: { monthly: 1399, yearly: 13999, currency: 'AUD', currencySymbol: 'AU$' },
  DE: { monthly: 899, yearly: 8999, currency: 'EUR', currencySymbol: '€' },
  FR: { monthly: 899, yearly: 8999, currency: 'EUR', currencySymbol: '€' },
  NL: { monthly: 899, yearly: 8999, currency: 'EUR', currencySymbol: '€' },
  CH: { monthly: 999, yearly: 9999, currency: 'CHF', currencySymbol: 'CHF' },
  NO: { monthly: 999, yearly: 9999, currency: 'NOK', currencySymbol: 'kr' },
  SE: { monthly: 999, yearly: 9999, currency: 'SEK', currencySymbol: 'kr' },
  DK: { monthly: 899, yearly: 8999, currency: 'DKK', currencySymbol: 'kr' },
  
  // Tier 2 - Middle income countries
  BR: { monthly: 1999, yearly: 19999, currency: 'BRL', currencySymbol: 'R$' },
  MX: { monthly: 9999, yearly: 99999, currency: 'MXN', currencySymbol: '$' },
  RU: { monthly: 59999, yearly: 599999, currency: 'RUB', currencySymbol: '₽' },
  TR: { monthly: 2999, yearly: 29999, currency: 'TRY', currencySymbol: '₺' },
  PL: { monthly: 3999, yearly: 39999, currency: 'PLN', currencySymbol: 'zł' },
  CZ: { monthly: 22999, yearly: 229999, currency: 'CZK', currencySymbol: 'Kč' },
  HU: { monthly: 349999, yearly: 3499999, currency: 'HUF', currencySymbol: 'Ft' },
  
  // Tier 3 - Lower middle income countries
  IN: { monthly: 49999, yearly: 499999, currency: 'INR', currencySymbol: '₹' },
  CN: { monthly: 6999, yearly: 69999, currency: 'CNY', currencySymbol: '¥' },
  TH: { monthly: 3499, yearly: 34999, currency: 'THB', currencySymbol: '฿' },
  VN: { monthly: 23999, yearly: 239999, currency: 'VND', currencySymbol: '₫' },
  ID: { monthly: 14999, yearly: 149999, currency: 'IDR', currencySymbol: 'Rp' },
  PH: { monthly: 54999, yearly: 549999, currency: 'PHP', currencySymbol: '₱' },
  MY: { monthly: 449, yearly: 4499, currency: 'MYR', currencySymbol: 'RM' },
  
  // Tier 4 - Lower income countries
  BD: { monthly: 99999, yearly: 999999, currency: 'BDT', currencySymbol: '৳' },
  PK: { monthly: 27999, yearly: 279999, currency: 'PKR', currencySymbol: '₨' },
  LK: { monthly: 34999, yearly: 349999, currency: 'LKR', currencySymbol: '₨' },
  NG: { monthly: 459999, yearly: 4599999, currency: 'NGN', currencySymbol: '₦' },
  KE: { monthly: 129999, yearly: 1299999, currency: 'KES', currencySymbol: 'KSh' },
  EG: { monthly: 1549, yearly: 15499, currency: 'EGP', currencySymbol: 'E£' },
  MA: { monthly: 9999, yearly: 99999, currency: 'MAD', currencySymbol: 'DH' },
  
  // Default fallback
  DEFAULT: { monthly: 999, yearly: 9999, currency: 'USD', currencySymbol: '$' }
};

export class LocationPricingService {
  private userCountry: string | null = null;

  async detectUserLocation(): Promise<string> {
    try {
      // Try to get country from multiple sources
      const country = await this.getCountryFromAPI();
      this.userCountry = country;
      return country;
    } catch (error) {
      console.warn('Failed to detect user location:', error);
      return 'DEFAULT';
    }
  }

  private async getCountryFromAPI(): Promise<string> {
    try {
      // Use a free IP geolocation service
      const response = await fetch('https://ipapi.co/country/', {
        method: 'GET',
        headers: { 'Accept': 'text/plain' }
      });
      
      if (response.ok) {
        const countryCode = await response.text();
        return countryCode.trim().toUpperCase();
      }
      
      throw new Error('Failed to get country from API');
    } catch (error) {
      // Fallback to browser locale
      const locale = navigator.language || 'en-US';
      const countryCode = locale.split('-')[1] || 'US';
      return countryCode.toUpperCase();
    }
  }

  getPricingForCountry(countryCode?: string): PricingTier {
    const country = countryCode || this.userCountry || 'DEFAULT';
    return LOCATION_PRICING[country] || LOCATION_PRICING.DEFAULT;
  }

  async getPricingForUser(): Promise<PricingTier> {
    if (!this.userCountry) {
      await this.detectUserLocation();
    }
    return this.getPricingForCountry();
  }

  formatPrice(amount: number, currency: string, currencySymbol: string): string {
    const displayAmount = amount / 100; // Convert from cents
    
    // Format based on currency
    if (currency === 'JPY' || currency === 'KRW' || currency === 'VND' || 
        currency === 'IDR' || currency === 'HUF' || currency === 'CLP') {
      // These currencies don't use decimal places
      return `${currencySymbol}${Math.round(displayAmount)}`;
    }
    
    return `${currencySymbol}${displayAmount.toFixed(2)}`;
  }

  getCurrencyForCountry(countryCode?: string): string {
    const pricing = this.getPricingForCountry(countryCode);
    return pricing.currency;
  }
}

export const locationPricingService = new LocationPricingService();
