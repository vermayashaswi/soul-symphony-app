
import { supabase } from '@/integrations/supabase/client';
import { FeatureFlags, AppFeatureFlag } from '@/types/featureFlags';

export interface FeatureFlagConfig {
  flag: AppFeatureFlag;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number;
  userGroups?: string[];
  expiresAt?: string;
}

class FeatureFlagService {
  private cache: Map<AppFeatureFlag, boolean> = new Map();
  private lastFetch: number = 0;
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  async getFlags(): Promise<FeatureFlags> {
    const now = Date.now();
    
    // Use cache if still valid
    if (this.cache.size > 0 && (now - this.lastFetch) < this.cacheExpiry) {
      return this.cacheToFlags();
    }

    try {
      // Fetch from Supabase
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('enabled', true);

      if (error) {
        console.warn('[FeatureFlagService] Error fetching flags:', error);
        return this.getDefaultFlags();
      }

      // Update cache
      this.cache.clear();
      data?.forEach(flag => {
        if (this.isValidFlag(flag.flag)) {
          this.cache.set(flag.flag as AppFeatureFlag, flag.enabled);
        }
      });

      this.lastFetch = now;
      return this.cacheToFlags();

    } catch (error) {
      console.error('[FeatureFlagService] Network error:', error);
      return this.getDefaultFlags();
    }
  }

  async isEnabled(flag: AppFeatureFlag): Promise<boolean> {
    const flags = await this.getFlags();
    return flags[flag] || false;
  }

  async updateFlag(flag: AppFeatureFlag, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .upsert({
          flag,
          enabled,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('[FeatureFlagService] Error updating flag:', error);
        return false;
      }

      // Update cache
      this.cache.set(flag, enabled);
      return true;

    } catch (error) {
      console.error('[FeatureFlagService] Error updating flag:', error);
      return false;
    }
  }

  async getAllConfigs(): Promise<FeatureFlagConfig[]> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('flag');

      if (error) {
        console.error('[FeatureFlagService] Error fetching configs:', error);
        return [];
      }

      return data?.map(item => ({
        flag: item.flag as AppFeatureFlag,
        enabled: item.enabled,
        description: item.description || '',
        rolloutPercentage: item.rollout_percentage,
        userGroups: item.user_groups,
        expiresAt: item.expires_at
      })) || [];

    } catch (error) {
      console.error('[FeatureFlagService] Error fetching configs:', error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.lastFetch = 0;
  }

  private cacheToFlags(): FeatureFlags {
    const flags: FeatureFlags = this.getDefaultFlags();
    
    this.cache.forEach((enabled, flag) => {
      flags[flag] = enabled;
    });

    return flags;
  }

  private getDefaultFlags(): FeatureFlags {
    return {
      smartChatV2: false,
      premiumMessaging: false,
      emotionCalendar: false,
      insightsV2: false,
      journalVoicePlayback: false,
      otherReservedFlags: false,
    };
  }

  private isValidFlag(flag: string): flag is AppFeatureFlag {
    const validFlags: AppFeatureFlag[] = [
      'smartChatV2',
      'premiumMessaging',
      'emotionCalendar',
      'insightsV2',
      'journalVoicePlayback',
      'otherReservedFlags'
    ];
    return validFlags.includes(flag as AppFeatureFlag);
  }
}

export const featureFlagService = new FeatureFlagService();
