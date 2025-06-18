
/**
 * Enhanced Feature Flag Service with Supabase Integration
 */

import { supabase } from '@/integrations/supabase/client';
import { AppFeatureFlag, FeatureFlags } from '@/types/featureFlags';

export interface FeatureFlagConfig {
  flag: AppFeatureFlag;
  enabled: boolean;
  conditions?: {
    userTier?: string[];
    platform?: string[];
    version?: string;
  };
  rolloutPercentage?: number;
  description?: string;
}

class FeatureFlagService {
  private flags: FeatureFlags = {
    smartChatV2: false,
    premiumMessaging: false,
    emotionCalendar: false,
    insightsV2: false,
    journalVoicePlayback: false,
    otherReservedFlags: false,
  };

  private isInitialized = false;
  private subscribers: Array<(flags: FeatureFlags) => void> = [];
  private realtimeChannel: any = null;

  /**
   * Initialize feature flags with real-time updates
   */
  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[FeatureFlags] Initializing feature flag service...');
      
      // Load flags from localStorage (cache)
      this.loadFromCache();
      
      // Try to fetch fresh flags from Supabase
      await this.fetchFlags(userId);
      
      // Set up real-time updates if user is authenticated
      if (userId) {
        this.setupRealtimeUpdates(userId);
      }
      
      this.isInitialized = true;
      console.log('[FeatureFlags] Service initialized with flags:', this.flags);
      
    } catch (error) {
      console.error('[FeatureFlags] Initialization failed:', error);
      // Continue with cached/default flags
      this.isInitialized = true;
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flag: AppFeatureFlag): boolean {
    return this.flags[flag] || false;
  }

  /**
   * Get all current flags
   */
  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Subscribe to flag changes
   */
  subscribe(callback: (flags: FeatureFlags) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Force refresh flags from server
   */
  async refresh(userId?: string): Promise<void> {
    try {
      await this.fetchFlags(userId);
    } catch (error) {
      console.error('[FeatureFlags] Refresh failed:', error);
    }
  }

  /**
   * Fetch flags from Supabase (or fallback to hardcoded for now)
   */
  private async fetchFlags(userId?: string): Promise<void> {
    try {
      // For now, we'll use environment-based flags since we don't have a feature_flags table
      // In production, this would fetch from Supabase
      
      const platformFlags = this.getPlatformSpecificFlags();
      const userTierFlags = await this.getUserTierFlags(userId);
      
      // Merge flags with priority: user tier > platform > default
      const newFlags: FeatureFlags = {
        ...this.flags,
        ...platformFlags,
        ...userTierFlags
      };

      // Check if flags have changed
      const hasChanged = JSON.stringify(newFlags) !== JSON.stringify(this.flags);
      
      if (hasChanged) {
        this.flags = newFlags;
        this.saveToCache();
        this.notifySubscribers();
        console.log('[FeatureFlags] Flags updated:', this.flags);
      }
      
    } catch (error) {
      console.error('[FeatureFlags] Error fetching flags:', error);
    }
  }

  /**
   * Get platform-specific flags
   */
  private getPlatformSpecificFlags(): Partial<FeatureFlags> {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    const isNativeApp = navigator.userAgent.includes('wv') || 
                       navigator.userAgent.includes('pwabuilder');
    
    // Enable features based on platform
    if (isNativeApp || isPWA) {
      return {
        journalVoicePlayback: true,
        emotionCalendar: true,
      };
    }

    return {
      insightsV2: true,
      smartChatV2: true,
    };
  }

  /**
   * Get user tier specific flags
   */
  private async getUserTierFlags(userId?: string): Promise<Partial<FeatureFlags>> {
    if (!userId) return {};

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, subscription_status')
        .eq('id', userId)
        .single();

      if (profile?.is_premium || profile?.subscription_status === 'trial') {
        return {
          premiumMessaging: true,
          smartChatV2: true,
          insightsV2: true,
        };
      }
    } catch (error) {
      console.error('[FeatureFlags] Error fetching user tier:', error);
    }

    return {};
  }

  /**
   * Set up real-time updates for feature flags
   */
  private setupRealtimeUpdates(userId: string): void {
    try {
      // Listen for profile changes that might affect feature flags
      this.realtimeChannel = supabase
        .channel('feature-flags-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`
          },
          () => {
            console.log('[FeatureFlags] Profile updated, refreshing flags...');
            this.fetchFlags(userId);
          }
        )
        .subscribe();

      console.log('[FeatureFlags] Real-time updates enabled');
      
    } catch (error) {
      console.error('[FeatureFlags] Error setting up real-time updates:', error);
    }
  }

  /**
   * Load flags from cache
   */
  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem('feature-flags');
      if (cached) {
        const cachedFlags = JSON.parse(cached);
        this.flags = { ...this.flags, ...cachedFlags };
        console.log('[FeatureFlags] Loaded from cache:', this.flags);
      }
    } catch (error) {
      console.error('[FeatureFlags] Error loading from cache:', error);
    }
  }

  /**
   * Save flags to cache
   */
  private saveToCache(): void {
    try {
      localStorage.setItem('feature-flags', JSON.stringify(this.flags));
    } catch (error) {
      console.error('[FeatureFlags] Error saving to cache:', error);
    }
  }

  /**
   * Notify all subscribers of flag changes
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.flags);
      } catch (error) {
        console.error('[FeatureFlags] Error notifying subscriber:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.subscribers = [];
    this.isInitialized = false;
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();
