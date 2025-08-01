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
  private updateRetryCount = new Map<string, number>();
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  async detectUserLocation(): Promise<ExtendedLocationData> {
    const cacheKey = 'user_location';
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      console.log('[EnhancedLocationService] Using cached location:', cached);
      return cached;
    }

    try {
      // Step 1: Try to detect timezone using browser API
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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

      // Update user profile if authenticated (with retry logic)
      await this.updateUserProfileWithRetry(locationData);

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

  private async updateUserProfileWithRetry(locationData: ExtendedLocationData): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('[EnhancedLocationService] No authenticated user found, skipping profile update');
      return;
    }

    const retryKey = user.id;
    const currentRetries = this.updateRetryCount.get(retryKey) || 0;

    try {
      // Check if profile exists first
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, timezone, country')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch profile: ${fetchError.message}`);
      }

      if (!existingProfile) {
        console.warn('[EnhancedLocationService] Profile not found, waiting for profile creation...');
        
        if (currentRetries < this.MAX_RETRY_ATTEMPTS) {
          this.updateRetryCount.set(retryKey, currentRetries + 1);
          setTimeout(() => {
            console.log(`[EnhancedLocationService] Retrying profile update (attempt ${currentRetries + 1}/${this.MAX_RETRY_ATTEMPTS})`);
            this.updateUserProfileWithRetry(locationData);
          }, this.RETRY_DELAY * (currentRetries + 1));
        } else {
          console.error('[EnhancedLocationService] Max retry attempts reached for profile update');
          this.updateRetryCount.delete(retryKey);
        }
        return;
      }

      // Only update if values are different and not already correct
      const needsUpdate = (
        existingProfile.timezone !== locationData.timezone || 
        existingProfile.country !== locationData.country ||
        existingProfile.country === 'DEFAULT' ||
        existingProfile.timezone === 'UTC'
      );

      if (!needsUpdate) {
        console.log('[EnhancedLocationService] Profile location data is already correct, skipping update');
        this.updateRetryCount.delete(retryKey);
        return;
      }

      console.log('[EnhancedLocationService] Updating profile with location data:', {
        from: { timezone: existingProfile.timezone, country: existingProfile.country },
        to: { timezone: locationData.timezone, country: locationData.country }
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          timezone: locationData.timezone,
          country: locationData.country,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(`Profile update failed: ${error.message}`);
      }

      console.log('[EnhancedLocationService] ✅ Profile successfully updated with location data');
      this.updateRetryCount.delete(retryKey);
      
    } catch (error) {
      console.error('[EnhancedLocationService] Error updating user profile:', error);
      
      if (currentRetries < this.MAX_RETRY_ATTEMPTS) {
        this.updateRetryCount.set(retryKey, currentRetries + 1);
        setTimeout(() => {
          console.log(`[EnhancedLocationService] Retrying profile update (attempt ${currentRetries + 1}/${this.MAX_RETRY_ATTEMPTS})`);
          this.updateUserProfileWithRetry(locationData);
        }, this.RETRY_DELAY * (currentRetries + 1));
      } else {
        console.error('[EnhancedLocationService] Max retry attempts reached for profile update');
        this.updateRetryCount.delete(retryKey);
      }
    }
  }

  // Maintain backward compatibility
  private async updateUserProfile(locationData: ExtendedLocationData): Promise<void> {
    return this.updateUserProfileWithRetry(locationData);
  }

  clearCache(): void {
    this.cache.clear();
    this.updateRetryCount.clear();
  }

  // Force update profile for specific user (useful for fixing existing users)
  async forceUpdateUserProfile(userId: string, locationData?: ExtendedLocationData): Promise<boolean> {
    try {
      const finalLocationData = locationData || await this.detectUserLocation();
      
      console.log('[EnhancedLocationService] Force updating profile for user:', userId, 'with data:', finalLocationData);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          timezone: finalLocationData.timezone,
          country: finalLocationData.country,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('[EnhancedLocationService] Force update failed:', error);
        return false;
      }

      console.log('[EnhancedLocationService] ✅ Force profile update completed successfully');
      return true;
    } catch (error) {
      console.error('[EnhancedLocationService] Force update error:', error);
      return false;
    }
  }
}

export const enhancedLocationService = new EnhancedLocationService();