import { supabase } from '@/integrations/supabase/client';

interface ExtendedLocationData {
  country: string;
  currency: string;
  timezone: string;
  ip?: string;
}

class EnhancedLocationService {
  private cache = new Map<string, ExtendedLocationData>();
  private cacheTimeout = 1000 * 60 * 60; // 1 hour

  async detectUserLocation(): Promise<ExtendedLocationData> {
    const cacheKey = 'user_location';
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      console.log('[EnhancedLocationService] Using cached location:', cached);
      return cached;
    }

    try {
      // Step 1: Try to detect timezone using browser API and normalize legacy timezones
      let detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Normalize legacy timezone identifiers
      if (detectedTimezone === 'Asia/Calcutta') {
        detectedTimezone = 'Asia/Kolkata';
        console.log('[EnhancedLocationService] Normalized legacy timezone Asia/Calcutta to Asia/Kolkata');
      }
      
      console.log('[EnhancedLocationService] Detected timezone:', detectedTimezone);

      // Step 2: Enhanced country detection based on timezone and language
      let detectedCountry = 'DEFAULT';
      let detectedCurrency = 'USD';

      // Comprehensive timezone-based country mapping for all 24 supported countries
      const timezoneCountryMap: Record<string, { country: string; currency: string }> = {
        // India
        'Asia/Kolkata': { country: 'IN', currency: 'INR' },
        'Asia/Calcutta': { country: 'IN', currency: 'INR' },
        
        // United States (multiple zones)
        'America/New_York': { country: 'US', currency: 'USD' },
        'America/Los_Angeles': { country: 'US', currency: 'USD' },
        'America/Chicago': { country: 'US', currency: 'USD' },
        'America/Denver': { country: 'US', currency: 'USD' },
        'America/Anchorage': { country: 'US', currency: 'USD' },
        'Pacific/Honolulu': { country: 'US', currency: 'USD' },
        
        // United Kingdom
        'Europe/London': { country: 'GB', currency: 'GBP' },
        
        // Canada (multiple zones)
        'America/Toronto': { country: 'CA', currency: 'CAD' },
        'America/Vancouver': { country: 'CA', currency: 'CAD' },
        'America/Winnipeg': { country: 'CA', currency: 'CAD' },
        'America/Edmonton': { country: 'CA', currency: 'CAD' },
        'America/Halifax': { country: 'CA', currency: 'CAD' },
        
        // Australia (multiple zones)
        'Australia/Sydney': { country: 'AU', currency: 'AUD' },
        'Australia/Melbourne': { country: 'AU', currency: 'AUD' },
        'Australia/Brisbane': { country: 'AU', currency: 'AUD' },
        'Australia/Perth': { country: 'AU', currency: 'AUD' },
        'Australia/Adelaide': { country: 'AU', currency: 'AUD' },
        'Australia/Darwin': { country: 'AU', currency: 'AUD' },
        
        // Europe
        'Europe/Berlin': { country: 'DE', currency: 'EUR' },
        'Europe/Paris': { country: 'FR', currency: 'EUR' },
        'Europe/Rome': { country: 'IT', currency: 'EUR' },
        'Europe/Madrid': { country: 'ES', currency: 'EUR' },
        'Europe/Amsterdam': { country: 'NL', currency: 'EUR' },
        'Europe/Stockholm': { country: 'SE', currency: 'EUR' },
        'Europe/Oslo': { country: 'NO', currency: 'EUR' },
        'Europe/Copenhagen': { country: 'DK', currency: 'EUR' },
        
        // Middle East
        'Asia/Dubai': { country: 'AE', currency: 'AED' },
        'Asia/Riyadh': { country: 'SA', currency: 'SAR' },
        
        // Asia
        'Asia/Tokyo': { country: 'JP', currency: 'JPY' },
        'Asia/Seoul': { country: 'KR', currency: 'KRW' },
        'Asia/Singapore': { country: 'SG', currency: 'USD' },
        'Asia/Kuala_Lumpur': { country: 'MY', currency: 'USD' },
        'Asia/Bangkok': { country: 'TH', currency: 'USD' },
        
        // Americas
        'America/Mexico_City': { country: 'MX', currency: 'MXN' },
        'America/Sao_Paulo': { country: 'BR', currency: 'BRL' },
        'America/Manaus': { country: 'BR', currency: 'BRL' },
        
        // Africa
        'Africa/Johannesburg': { country: 'ZA', currency: 'USD' },
        'Africa/Lagos': { country: 'NG', currency: 'USD' },
      };

      const timezoneMatch = timezoneCountryMap[detectedTimezone];
      if (timezoneMatch) {
        detectedCountry = timezoneMatch.country;
        detectedCurrency = timezoneMatch.currency;
      } else {
        // Step 3: Fallback to language-based detection
        const language = navigator.language || navigator.languages?.[0] || 'en-US';
        const region = language.split('-')[1]?.toUpperCase();
        
        const regionMap: Record<string, { country: string; currency: string }> = {
          'IN': { country: 'IN', currency: 'INR' },
          'US': { country: 'US', currency: 'USD' },
          'GB': { country: 'GB', currency: 'GBP' },
          'CA': { country: 'CA', currency: 'CAD' },
          'AU': { country: 'AU', currency: 'AUD' },
          'DE': { country: 'DE', currency: 'EUR' },
          'FR': { country: 'FR', currency: 'EUR' },
          'IT': { country: 'IT', currency: 'EUR' },
          'ES': { country: 'ES', currency: 'EUR' },
          'NL': { country: 'NL', currency: 'EUR' },
          'SE': { country: 'SE', currency: 'EUR' },
          'NO': { country: 'NO', currency: 'EUR' },
          'DK': { country: 'DK', currency: 'EUR' },
          'AE': { country: 'AE', currency: 'AED' },
          'SA': { country: 'SA', currency: 'SAR' },
          'JP': { country: 'JP', currency: 'JPY' },
          'KR': { country: 'KR', currency: 'KRW' },
          'SG': { country: 'SG', currency: 'USD' },
          'MY': { country: 'MY', currency: 'USD' },
          'TH': { country: 'TH', currency: 'USD' },
          'MX': { country: 'MX', currency: 'MXN' },
          'BR': { country: 'BR', currency: 'BRL' },
          'ZA': { country: 'ZA', currency: 'USD' },
          'NG': { country: 'NG', currency: 'USD' },
        };

        const regionMatch = regionMap[region || ''];
        if (regionMatch) {
          detectedCountry = regionMatch.country;
          detectedCurrency = regionMatch.currency;
        }
      }

      const locationData: ExtendedLocationData = {
        country: detectedCountry,
        currency: detectedCurrency,
        timezone: detectedTimezone
      };

      console.log('[EnhancedLocationService] Final detected location:', locationData);

      // Cache the result
      this.cache.set(cacheKey, locationData);
      setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

      // Update user profile if authenticated
      await this.updateUserProfile(locationData);

      return locationData;
    } catch (error) {
      console.error('[EnhancedLocationService] Location detection failed:', error);
      
      // Return fallback location
      const fallbackLocation: ExtendedLocationData = {
        country: 'DEFAULT',
        currency: 'USD',
        timezone: 'UTC'
      };
      
      return fallbackLocation;
    }
  }

  private async updateUserProfile(locationData: ExtendedLocationData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Only update if we have a valid country (not DEFAULT)
        const updateData: any = {
          timezone: locationData.timezone,
          updated_at: new Date().toISOString()
        };
        
        // Only update country if we detected a valid one (not DEFAULT)
        if (locationData.country !== 'DEFAULT') {
          updateData.country = locationData.country;
        }

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);

        if (error) {
          console.error('[EnhancedLocationService] Failed to update user profile:', error);
        } else {
          console.log('[EnhancedLocationService] User profile updated with location data:', updateData);
        }
      }
    } catch (error) {
      console.error('[EnhancedLocationService] Error updating user profile:', error);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const enhancedLocationService = new EnhancedLocationService();