
import { useFeatureFlagsContext } from "../contexts/FeatureFlagsContext";
import { AppFeatureFlag } from "../types/featureFlags";

/**
 * Custom hook to easily check if a feature flag is enabled.
 * Example: const { isEnabled, loading } = useFeatureFlag("premiumMessaging");
 */
export const useFeatureFlag = (flag: AppFeatureFlag) => {
  const { isEnabled, loading, error, refetch } = useFeatureFlagsContext();
  
  return {
    isEnabled: isEnabled(flag),
    loading,
    error,
    refetch,
  };
};

/**
 * Hook to get all feature flags and context
 */
export const useAllFeatureFlags = () => {
  const context = useFeatureFlagsContext();
  return context;
};
