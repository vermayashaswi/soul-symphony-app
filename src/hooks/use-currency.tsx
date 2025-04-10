
import { useState, useEffect } from 'react';

// Define available currencies
type Currency = {
  code: string;
  symbol: string;
  name: string;
  rate: number; // Exchange rate relative to USD
};

const currencies: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.79 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 151.68 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 83.45 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 1.35 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.49 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rate: 7.23 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rate: 5.07 },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', rate: 92.37 }
];

// Detect user's currency based on browser locale
export const detectUserCurrency = (): string => {
  try {
    // Try to get currency from localStorage first
    const savedCurrency = localStorage.getItem('preferredCurrency');
    if (savedCurrency) return savedCurrency;
    
    // Get from browser locale
    const userLocale = navigator.language;
    
    // Map common locales to currencies
    const localeToCurrency: Record<string, string> = {
      'en-US': 'USD',
      'en-GB': 'GBP',
      'en-IN': 'INR',
      'en-CA': 'CAD',
      'en-AU': 'AUD',
      'ja': 'JPY',
      'ja-JP': 'JPY',
      'de': 'EUR',
      'de-DE': 'EUR',
      'fr': 'EUR',
      'fr-FR': 'EUR',
      'it': 'EUR',
      'es': 'EUR',
      'zh': 'CNY',
      'zh-CN': 'CNY',
      'ru': 'RUB',
      'pt-BR': 'BRL',
      'hi': 'INR',
    };
    
    // Check if we have a direct mapping
    if (localeToCurrency[userLocale]) {
      return localeToCurrency[userLocale];
    }
    
    // Try with just the language part
    const langPart = userLocale.split('-')[0];
    if (localeToCurrency[langPart]) {
      return localeToCurrency[langPart];
    }
    
    // Default to USD if no mapping found
    return 'USD';
  } catch (error) {
    console.error('Error detecting user currency:', error);
    return 'USD';
  }
};

export const useCurrency = () => {
  const [currentCurrency, setCurrentCurrency] = useState<string>(detectUserCurrency());
  
  // Set currency in localStorage when it changes
  useEffect(() => {
    localStorage.setItem('preferredCurrency', currentCurrency);
  }, [currentCurrency]);
  
  // Convert a USD amount to the selected currency
  const formatPrice = (amount: number, showCode = false): string => {
    try {
      const currency = currencies.find(c => c.code === currentCurrency) || currencies[0];
      const converted = amount * currency.rate;
      
      // Format the number with the appropriate decimals
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(converted);
      
      return `${currency.symbol}${formatted}${showCode ? ` ${currency.code}` : ''}`;
    } catch (error) {
      console.error('Error formatting price:', error);
      return `$${amount}`;
    }
  };
  
  // Convert between pricing plans (monthly/yearly/lifetime)
  const convertPlanPrice = (basePriceUSD: number, plan: 'monthly' | 'yearly' | 'lifetime'): number => {
    switch (plan) {
      case 'monthly':
        return basePriceUSD; // Base monthly price
      case 'yearly':
        return basePriceUSD * 12 * 0.8; // 20% discount on yearly
      case 'lifetime':
        return basePriceUSD * 40; // Lifetime is equivalent to ~3.3 years of monthly
      default:
        return basePriceUSD;
    }
  };
  
  // Get subscription period text
  const getPeriodText = (plan: 'monthly' | 'yearly' | 'lifetime'): string => {
    switch (plan) {
      case 'monthly':
        return 'per month';
      case 'yearly':
        return 'per year';
      case 'lifetime':
        return 'one-time payment';
      default:
        return '';
    }
  };
  
  return {
    currency: currentCurrency,
    setCurrency: setCurrentCurrency,
    formatPrice,
    convertPlanPrice,
    getPeriodText,
    currencies
  };
};

export default useCurrency;
