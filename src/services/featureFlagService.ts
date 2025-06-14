
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type FeatureFlag = Tables<'feature_flags'>;
export type UserFeatureFlag = Tables<'user_feature_flags'>;

interface FeatureFlagEvaluation {
  enabled: boolean;
  reason: 'global_enabled' | 'global_disabled' | 'user_override' | 'percentage_rollout' | 'not_found';
}

class FeatureFlagService {
  private cache = new Map<string, FeatureFlag>();
  private userOverrides = new Map<string, boolean>();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async loadFeatureFlags(): Promise<void> {
    try {
      const { data: flags, error } = await supabase
        .from('feature_flags')
        .select('*');

      if (error) {
        console.error('[FeatureFlags] Error loading feature flags:', error);
        return;
      }

      // Update cache
      this.cache.clear();
      flags?.forEach(flag => {
        this.cache.set(flag.name, flag);
      });

      this.lastCacheUpdate = Date.now();
      console.log(`[FeatureFlags] Loaded ${flags?.length || 0} feature flags`);
    } catch (error) {
      console.error('[FeatureFlags] Failed to load feature flags:', error);
    }
  }

  async loadUserOverrides(userId: string): Promise<void> {
    try {
      const { data: overrides, error } = await supabase
        .from('user_feature_flags')
        .select(`
          is_enabled,
          feature_flags:feature_flag_id (name)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('[FeatureFlags] Error loading user overrides:', error);
        return;
      }

      // Update user overrides cache
      this.userOverrides.clear();
      overrides?.forEach(override => {
        const flagName = (override.feature_flags as any)?.name;
        if (flagName) {
          this.userOverrides.set(flagName, override.is_enabled);
        }
      });

      console.log(`[FeatureFlags] Loaded ${overrides?.length || 0} user overrides`);
    } catch (error) {
      console.error('[FeatureFlags] Failed to load user overrides:', error);
    }
  }

  async isFeatureEnabled(flagName: string, userId?: string): Promise<FeatureFlagEvaluation> {
    // Refresh cache if needed
    if (Date.now() - this.lastCacheUpdate > this.CACHE_TTL) {
      await this.loadFeatureFlags();
      if (userId) {
        await this.loadUserOverrides(userId);
      }
    }

    // Check user override first
    if (userId && this.userOverrides.has(flagName)) {
      return {
        enabled: this.userOverrides.get(flagName)!,
        reason: 'user_override'
      };
    }

    const flag = this.cache.get(flagName);
    if (!flag) {
      return { enabled: false, reason: 'not_found' };
    }

    // Check global enable/disable
    if (!flag.is_enabled) {
      return { enabled: false, reason: 'global_disabled' };
    }

    // Check percentage rollout
    if (flag.target_percentage >= 100) {
      return { enabled: true, reason: 'global_enabled' };
    }

    // Percentage-based rollout using user ID hash for consistency
    if (userId && flag.target_percentage > 0) {
      const hash = this.hashUserId(userId + flagName);
      const userPercentile = hash % 100;
      
      if (userPercentile < flag.target_percentage) {
        return { enabled: true, reason: 'percentage_rollout' };
      }
    }

    return { enabled: false, reason: 'global_disabled' };
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    if (Date.now() - this.lastCacheUpdate > this.CACHE_TTL) {
      await this.loadFeatureFlags();
    }
    return Array.from(this.cache.values());
  }

  async updateFlag(id: string, updates: Partial<FeatureFlag>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('[FeatureFlags] Error updating flag:', error);
        return false;
      }

      // Refresh cache
      await this.loadFeatureFlags();
      return true;
    } catch (error) {
      console.error('[FeatureFlags] Failed to update flag:', error);
      return false;
    }
  }

  async setUserOverride(userId: string, flagId: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_feature_flags')
        .upsert({
          user_id: userId,
          feature_flag_id: flagId,
          is_enabled: enabled
        });

      if (error) {
        console.error('[FeatureFlags] Error setting user override:', error);
        return false;
      }

      // Refresh user overrides
      await this.loadUserOverrides(userId);
      return true;
    } catch (error) {
      console.error('[FeatureFlags] Failed to set user override:', error);
      return false;
    }
  }

  private hashUserId(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  clearCache(): void {
    this.cache.clear();
    this.userOverrides.clear();
    this.lastCacheUpdate = 0;
  }
}

export const featureFlagService = new FeatureFlagService();
