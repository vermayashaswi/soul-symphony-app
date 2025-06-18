
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
  private cacheExpiry: number = 30 * 1000; // 30 seconds for faster updates

  async getFlags(): Promise<FeatureFlags> {
    const now = Date.now();
    
    // Use cache if still valid
    if (this.cache.size > 0 && (now - this.lastFetch) < this.cacheExpiry) {
      return this.cacheToFlags();
    }

    // For now, use local storage and default values
    // This can be extended to use a remote service later
    try {
      const localFlags = localStorage.getItem('feature_flags');
      if (localFlags) {
        const parsed = JSON.parse(localFlags);
        this.cache.clear();
        Object.entries(parsed).forEach(([flag, enabled]) => {
          if (this.isValidFlag(flag)) {
            this.cache.set(flag as AppFeatureFlag, enabled as boolean);
          }
        });
      }

      this.lastFetch = now;
      return this.cacheToFlags();

    } catch (error) {
      console.error('[FeatureFlagService] Error loading flags:', error);
      return this.getDefaultFlags();
    }
  }

  async isEnabled(flag: AppFeatureFlag): Promise<boolean> {
    const flags = await this.getFlags();
    return flags[flag] || false;
  }

  async updateFlag(flag: AppFeatureFlag, enabled: boolean): Promise<boolean> {
    try {
      // Update local storage
      const currentFlags = await this.getFlags();
      currentFlags[flag] = enabled;
      
      localStorage.setItem('feature_flags', JSON.stringify(currentFlags));
      
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
      const flags = await this.getFlags();
      
      return Object.entries(flags).map(([flag, enabled]) => ({
        flag: flag as AppFeatureFlag,
        enabled,
        description: this.getFlagDescription(flag as AppFeatureFlag),
        rolloutPercentage: 100,
        userGroups: [],
        expiresAt: undefined
      }));

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

  private getFlagDescription(flag: AppFeatureFlag): string {
    const descriptions: Record<AppFeatureFlag, string> = {
      smartChatV2: 'Enhanced AI chat capabilities',
      premiumMessaging: 'Premium messaging features',
      emotionCalendar: 'Emotion tracking calendar',
      insightsV2: 'Advanced insights dashboard',
      journalVoicePlayback: 'Voice playback for journal entries',
      otherReservedFlags: 'Reserved for future features'
    };
    return descriptions[flag] || '';
  }
}

export const featureFlagService = new FeatureFlagService();
