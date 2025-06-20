
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
  sessionFingerprint?: string;
  browserInfo?: Record<string, any>;
  deviceFingerprint?: string;
  platform?: string;
}

interface LocationData {
  country: string;
  currency: string;
  timezone: string;
}

interface SessionInfo {
  sessionId: string;
  isNewSession: boolean;
  sessionStart: Date;
}

export class SessionTrackingService {
  private static locationCache: LocationData | null = null;
  private static locationPromise: Promise<LocationData | null> | null = null;
  private static currentSessionId: string | null = null;
  private static sessionStartTime: Date | null = null;

  /**
   * Generate a unique browser fingerprint
   */
  private static generateBrowserFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.cookieEnabled,
      canvas.toDataURL()
    ].join('|');
    
    return btoa(fingerprint).substring(0, 32);
  }

  /**
   * Generate session fingerprint combining device and timing info
   */
  private static generateSessionFingerprint(): string {
    const browserFingerprint = this.generateBrowserFingerprint();
    const timestamp = Math.floor(Date.now() / (1000 * 60 * 30)); // 30-minute windows
    
    return `${browserFingerprint}_${timestamp}`;
  }

  /**
   * Get browser information
   */
  private static getBrowserInfo(): Record<string, any> {
    return {
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset()
    };
  }

  /**
   * Detect user's location using multiple fallback methods
   */
  static async detectLocation(): Promise<LocationData | null> {
    if (this.locationCache) {
      return this.locationCache;
    }

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
   * Create or update user session with enhanced tracking and proper session management
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

      // Generate session fingerprint and browser info if not provided
      const sessionFingerprint = data.sessionFingerprint || this.generateSessionFingerprint();
      const browserInfo = data.browserInfo || this.getBrowserInfo();
      const deviceFingerprint = data.deviceFingerprint || this.generateBrowserFingerprint();

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
          p_session_fingerprint: sessionFingerprint,
          p_browser_info: browserInfo,
          p_device_fingerprint: deviceFingerprint,
          p_platform: data.platform || navigator.platform
        });

      if (error) {
        console.error('Error creating enhanced user session:', error);
        return null;
      }

      // Store current session info
      this.currentSessionId = sessionId;
      this.sessionStartTime = new Date();

      console.log('Enhanced user session created/updated successfully with ID:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('Exception creating enhanced user session:', error);
      return null;
    }
  }

  /**
   * Get current session information
   */
  static getCurrentSession(): SessionInfo | null {
    if (!this.currentSessionId) {
      return null;
    }

    return {
      sessionId: this.currentSessionId,
      isNewSession: this.sessionStartTime ? (Date.now() - this.sessionStartTime.getTime()) < 60000 : false,
      sessionStart: this.sessionStartTime || new Date()
    };
  }

  /**
   * Update current session activity
   */
  static async updateSessionActivity(lastActivePage: string): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    try {
      // This will update the session through the enhanced_manage_user_session function
      // by calling it with the same fingerprint, which will update the existing session
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        return;
      }

      await this.createUserSession({
        userId: currentUser.data.user.id,
        deviceType: this.getDeviceType(),
        userAgent: navigator.userAgent,
        entryPage: document.referrer || window.location.pathname,
        lastActivePage: lastActivePage,
        language: navigator.language,
        sessionFingerprint: this.generateSessionFingerprint(),
        browserInfo: this.getBrowserInfo(),
        deviceFingerprint: this.generateBrowserFingerprint(),
        platform: navigator.platform
      });
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  /**
   * Close current session
   */
  static async closeCurrentSession(): Promise<boolean> {
    if (!this.currentSessionId) {
      return false;
    }

    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        return false;
      }

      const { data: success, error } = await supabase
        .rpc('close_user_session', {
          p_session_id: this.currentSessionId,
          p_user_id: currentUser.data.user.id
        });

      if (error) {
        console.error('Error closing user session:', error);
        return false;
      }

      // Clear local session info
      this.currentSessionId = null;
      this.sessionStartTime = null;

      console.log('Session closed successfully');
      return success;
    } catch (error) {
      console.error('Exception closing session:', error);
      return false;
    }
  }

  /**
   * Track conversion event in current session
   */
  static async trackConversion(eventType: string, eventData: Record<string, any> = {}): Promise<void> {
    if (!this.currentSessionId) {
      console.warn('No active session to track conversion');
      return;
    }

    try {
      const { error } = await supabase
        .rpc('track_conversion_event', {
          p_session_id: this.currentSessionId,
          p_event_type: eventType,
          p_event_data: eventData,
        });

      if (error) {
        console.error('Error tracking conversion event:', error);
      } else {
        console.log('Conversion event tracked:', eventType, eventData);
      }
    } catch (error) {
      console.error('Exception tracking conversion event:', error);
    }
  }

  /**
   * Get device type based on user agent and screen size
   */
  private static getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent) || (window.innerWidth >= 768 && window.innerWidth <= 1024);
    
    if (isMobile && !isTablet) {
      return 'mobile';
    } else if (isTablet) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Get attribution analytics
   */
  static async getAttributionAnalytics(startDate?: string, endDate?: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_attribution_analytics', {
          p_start_date: startDate,
          p_end_date: endDate,
        });

      if (error) {
        console.error('Error getting attribution analytics:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception getting attribution analytics:', error);
      return null;
    }
  }

  /**
   * Initialize session tracking for the current user
   */
  static async initializeSessionTracking(): Promise<string | null> {
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        return null;
      }

      const locationData = await this.detectLocation();
      const utmParams = this.extractUtmParameters();

      const sessionData: SessionTrackingData = {
        userId: currentUser.data.user.id,
        deviceType: this.getDeviceType(),
        userAgent: navigator.userAgent,
        entryPage: window.location.pathname,
        lastActivePage: window.location.pathname,
        language: navigator.language,
        referrer: document.referrer || undefined,
        countryCode: locationData?.country,
        currency: locationData?.currency,
        utmSource: utmParams.utm_source,
        utmMedium: utmParams.utm_medium,
        utmCampaign: utmParams.utm_campaign,
        utmTerm: utmParams.utm_term,
        utmContent: utmParams.utm_content,
        gclid: utmParams.gclid,
        fbclid: utmParams.fbclid,
        platform: navigator.platform
      };

      return await this.createUserSession(sessionData);
    } catch (error) {
      console.error('Error initializing session tracking:', error);
      return null;
    }
  }
}

// Auto-initialize session tracking when the service is imported
if (typeof window !== 'undefined') {
  // Initialize session tracking when the page loads
  window.addEventListener('load', () => {
    SessionTrackingService.initializeSessionTracking();
  });

  // Update session activity on page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      SessionTrackingService.updateSessionActivity(window.location.pathname);
    }
  });

  // Track page navigation
  let lastPath = window.location.pathname;
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      SessionTrackingService.updateSessionActivity(window.location.pathname);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });

  // Close session on page unload
  window.addEventListener('beforeunload', () => {
    SessionTrackingService.closeCurrentSession();
  });
}
