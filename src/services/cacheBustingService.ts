
import { supabase } from '@/integrations/supabase/client';

export class CacheBustingService {
  private static readonly CACHE_VERSION_KEY = 'app_cache_version';
  private static readonly LAST_UPDATE_KEY = 'last_feature_flag_update';

  /**
   * Check if cache should be busted based on feature flag updates
   */
  static async shouldBustCache(): Promise<boolean> {
    try {
      // Get the latest update timestamp from feature flags table
      const { data, error } = await supabase
        .from('feature_flags')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.warn('[CacheBusting] Could not fetch latest update timestamp:', error);
        return false;
      }

      const latestUpdate = new Date(data.updated_at).getTime();
      const lastKnownUpdate = localStorage.getItem(this.LAST_UPDATE_KEY);

      if (!lastKnownUpdate || parseInt(lastKnownUpdate) < latestUpdate) {
        console.log('[CacheBusting] Cache should be busted - new updates detected');
        localStorage.setItem(this.LAST_UPDATE_KEY, latestUpdate.toString());
        return true;
      }

      return false;
    } catch (error) {
      console.error('[CacheBusting] Error checking cache bust status:', error);
      return false;
    }
  }

  /**
   * Force a cache bust by updating the cache version
   */
  static bustCache(): void {
    const newVersion = Date.now().toString();
    localStorage.setItem(this.CACHE_VERSION_KEY, newVersion);
    console.log('[CacheBusting] Cache busted with version:', newVersion);
  }

  /**
   * Get current cache version
   */
  static getCacheVersion(): string {
    return localStorage.getItem(this.CACHE_VERSION_KEY) || '0';
  }

  /**
   * Check and perform cache busting if needed
   */
  static async performCacheBustingCheck(): Promise<void> {
    try {
      const shouldBust = await this.shouldBustCache();
      if (shouldBust) {
        this.bustCache();
        // For native apps, we could also trigger a page reload
        if (this.isNativeApp()) {
          console.log('[CacheBusting] Native app detected - triggering refresh');
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('[CacheBusting] Error performing cache busting check:', error);
    }
  }

  /**
   * Detect if running in native app
   */
  private static isNativeApp(): boolean {
    return /native/i.test(window.navigator.userAgent) || 
           window.location.protocol === 'capacitor:' ||
           (window as any).Capacitor;
  }
}
