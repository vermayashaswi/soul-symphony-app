
import { useState, useEffect, useCallback } from 'react';
import { featureFlagService, FeatureFlag } from '@/services/featureFlagService';
import { useAuth } from '@/contexts/AuthContext';

interface FeatureFlagHookResult {
  isEnabled: (flagName: string) => boolean;
  flags: FeatureFlag[];
  loading: boolean;
  refreshFlags: () => Promise<void>;
}

export const useFeatureFlags = (): FeatureFlagHookResult => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [evaluations, setEvaluations] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load feature flags
      await featureFlagService.loadFeatureFlags();
      const allFlags = await featureFlagService.getAllFlags();
      setFlags(allFlags);

      // Load user overrides if user is authenticated
      if (user?.id) {
        await featureFlagService.loadUserOverrides(user.id);
      }

      // Evaluate all flags for current user
      const newEvaluations = new Map<string, boolean>();
      for (const flag of allFlags) {
        const evaluation = await featureFlagService.isFeatureEnabled(flag.name, user?.id);
        newEvaluations.set(flag.name, evaluation.enabled);
      }
      
      setEvaluations(newEvaluations);
      console.log('[useFeatureFlags] Loaded and evaluated flags:', Object.fromEntries(newEvaluations));
    } catch (error) {
      console.error('[useFeatureFlags] Error loading flags:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const refreshFlags = useCallback(async () => {
    featureFlagService.clearCache();
    await loadFlags();
  }, [loadFlags]);

  const isEnabled = useCallback((flagName: string): boolean => {
    return evaluations.get(flagName) ?? false;
  }, [evaluations]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  return {
    isEnabled,
    flags,
    loading,
    refreshFlags
  };
};

// Utility hook for checking a single feature flag
export const useFeatureFlag = (flagName: string): boolean => {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flagName);
};
