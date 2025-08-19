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

      // Timezone-based country mapping
      const timezoneCountryMap: Record<string, { country: string; currency: string }> = {
        'Asia/Kolkata': { country: 'IN', currency: 'INR' },
        'Asia/Calcutta': { country: 'IN', currency: 'INR' },
        'America/New_York': { country: 'US', currency: 'USD' },
        'America/Los_Angeles': { country: 'US', currency: 'USD' },
        'Europe/London': { country: 'GB', currency: 'GBP' },
        'America/Toronto': { country: 'CA', currency: 'CAD' },
        'Australia/Sydney': { country: 'AU', currency: 'AUD' },
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