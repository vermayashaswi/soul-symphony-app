
import { supabase } from '@/integrations/supabase/client';

interface SessionTrackingData {
  userId: string;
  deviceType: string;
  userAgent: string;
  entryPage: string;
  lastActivePage: string;
  language?: string;
  referrer?: string;
  ipAddress?: string;
  countryCode?: string;
  currency?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  attributionData?: Record<string, any>;
}

interface LocationData {
  country: string;
  currency: string;
  timezone: string;
}

export class SessionTrackingService {
  private static locationCache: LocationData | null = null;
  private static locationPromise: Promise<LocationData | null> | null = null;

  /**
   * Detect user's location using multiple fallback methods
   */
  static async detectLocation(): Promise<LocationData | null> {
    // Return cached result if available
    if (this.locationCache) {
      return this.locationCache;
    }

    // Return ongoing promise if detection is in progress
    if (this.locationPromise) {
      return this.locationPromise;
    }

    this.locationPromise = this.performLocationDetection();
    const result = await this.locationPromise;
    
    if (result) {
      this.locationCache = result;
    }
    
    this.locationPromise = null;
    return result;
  }

  private static async performLocationDetection(): Promise<LocationData | null> {
    try {
      // Method 1: Try ipapi.co (free tier, good accuracy)
      try {
        const response = await fetch('https://ipapi.co/json/', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.country_code && data.currency) {
            console.log('Location detected via ipapi.co:', data.country_code, data.currency);
            return {
              country: data.country_code,
              currency: data.currency,
              timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            };
          }
        }
      } catch (error) {
        console.warn('ipapi.co failed:', error);
      }

      // Method 2: Try ip-api.com as fallback
      try {
        const response = await fetch('http://ip-api.com/json/', {
          method: 'GET',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.countryCode) {
            console.log('Location detected via ip-api.com:', data.countryCode);
            return {
              country: data.countryCode,
              currency: this.getCurrencyFromCountry(data.countryCode),
              timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            };
          }
        }
      } catch (error) {
        console.warn('ip-api.com failed:', error);
      }

      // Method 3: Use browser timezone as last resort
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const countryFromTimezone = this.getCountryFromTimezone(timezone);
      
      if (countryFromTimezone) {
        console.log('Location estimated from timezone:', countryFromTimezone);
        return {
          country: countryFromTimezone,
          currency: this.getCurrencyFromCountry(countryFromTimezone),
          timezone,
        };
      }

    } catch (error) {
      console.error('Location detection failed:', error);
    }

    return null;
  }

  /**
   * Get currency code from country code
   */
  private static getCurrencyFromCountry(countryCode: string): string {
    const currencyMap: Record<string, string> = {
      'US': 'USD', 'CA': 'CAD', 'GB': 'GBP', 'AU': 'AUD', 'NZ': 'NZD',
      'JP': 'JPY', 'KR': 'KRW', 'CN': 'CNY', 'IN': 'INR', 'SG': 'SGD',
      'HK': 'HKD', 'TW': 'TWD', 'TH': 'THB', 'VN': 'VND', 'MY': 'MYR',
      'ID': 'IDR', 'PH': 'PHP', 'BD': 'BDT', 'PK': 'PKR', 'LK': 'LKR',
      'AT': 'EUR', 'BE': 'EUR', 'CY': 'EUR', 'EE': 'EUR', 'FI': 'EUR',
      'FR': 'EUR', 'DE': 'EUR', 'GR': 'EUR', 'IE': 'EUR', 'IT': 'EUR',
      'LV': 'EUR', 'LT': 'EUR', 'LU': 'EUR', 'MT': 'EUR', 'NL': 'EUR',
      'PT': 'EUR', 'SK': 'EUR', 'SI': 'EUR', 'ES': 'EUR', 'CH': 'CHF',
      'NO': 'NOK', 'SE': 'SEK', 'DK': 'DKK', 'PL': 'PLN', 'CZ': 'CZK',
      'HU': 'HUF', 'RO': 'RON', 'BG': 'BGN', 'HR': 'HRK', 'RU': 'RUB',
      'UA': 'UAH', 'TR': 'TRY', 'IL': 'ILS', 'SA': 'SAR', 'AE': 'AED',
      'EG': 'EGP', 'ZA': 'ZAR', 'NG': 'NGN', 'KE': 'KES', 'GH': 'GHS',
      'BR': 'BRL', 'AR': 'ARS', 'CL': 'CLP', 'CO': 'COP', 'PE': 'PEN',
      'MX': 'MXN', 'CR': 'CRC', 'GT': 'GTQ', 'PA': 'PAB', 'UY': 'UYU',
    };
    
    return currencyMap[countryCode] || 'USD';
  }

  /**
   * Estimate country from timezone (rough approximation)
   */
  private static getCountryFromTimezone(timezone: string): string | null {
    const timezoneMap: Record<string, string> = {
      'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
      'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Montreal': 'CA',
      'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Europe/Amsterdam': 'NL', 'Europe/Stockholm': 'SE',
      'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL',
      'Europe/Prague': 'CZ', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH', 'Europe/Budapest': 'HU',
      'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK',
      'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH', 'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID',
      'Asia/Kuala_Lumpur': 'MY', 'Asia/Kolkata': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK',
      'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU',
      'Pacific/Auckland': 'NZ', 'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG',
      'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX', 'America/Argentina/Buenos_Aires': 'AR',
    };

    return timezoneMap[timezone] || null;
  }

  /**
   * Extract UTM parameters from URL
   */
  static extractUtmParameters(url: string = window.location.href): Record<string, string> {
    const urlParams = new URLSearchParams(new URL(url).search);
    const utmParams: Record<string, string> = {};

    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
    
    utmKeys.forEach(key => {
      const value = urlParams.get(key);
      if (value) {
        utmParams[key] = value;
      }
    });

    return utmParams;
  }

  /**
   * Create or update user session with enhanced tracking
   */
  static async createUserSession(data: SessionTrackingData): Promise<string | null> {
    try {
      console.log('Creating enhanced user session with tracking data:', {
        userId: data.userId,
        deviceType: data.deviceType,
        countryCode: data.countryCode,
        currency: data.currency,
        utmSource: data.utmSource,
        language: data.language,
      });

      const { data: sessionId, error } = await supabase
        .rpc('enhanced_manage_user_session', {
          p_user_id: data.userId,
          p_device_type: data.deviceType,
          p_user_agent: data.userAgent,
          p_entry_page: data.entryPage,
          p_last_active_page: data.lastActivePage,
          p_language: data.language,
          p_referrer: data.referrer,
          p_ip_address: data.ipAddress,
          p_country_code: data.countryCode,
          p_currency: data.currency,
          p_utm_source: data.utmSource,
          p_utm_medium: data.utmMedium,
          p_utm_campaign: data.utmCampaign,
          p_utm_term: data.utmTerm,
          p_utm_content: data.utmContent,
          p_gclid: data.gclid,
          p_fbclid: data.fbclid,
          p_attribution_data: data.attributionData || {},
        });

      if (error) {
        console.error('Error creating enhanced user session:', error);
        return null;
      }

      console.log('Enhanced user session created successfully with ID:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('Exception creating enhanced user session:', error);
      return null;
    }
  }

  /**
   * Track conversion event (simplified for security)
   */
  static async trackConversion(sessionId: string, eventType: string, eventData: Record<string, any> = {}): Promise<void> {
    try {
      console.log('Conversion event tracked:', eventType, eventData);
      // Note: Database function removed for security - implement via edge function if needed
    } catch (error) {
      console.error('Exception tracking conversion event:', error);
    }
  }

  /**
   * Get attribution analytics (simplified for security)
   */
  static async getAttributionAnalytics(startDate?: string, endDate?: string) {
    try {
      console.log('Attribution analytics requested for period:', startDate, endDate);
      // Note: Database function removed for security - implement via edge function if needed
      return null;
    } catch (error) {
      console.error('Exception getting attribution analytics:', error);
      return null;
    }
  }
}
