
import { useFeatureFlagsContext } from "../contexts/FeatureFlagsContext";
import { AppFeatureFlag } from "../types/featureFlags";
import { useEffect } from "react";

/**
 * Custom hook to easily check if a feature flag is enabled.
 * Example: const isEnabled = useFeatureFlag("smartChatV2");
 */
export const useFeatureFlag = (flag: AppFeatureFlag): boolean => {
  const { isEnabled, flags, loading } = useFeatureFlagsContext();
  
  // Enhanced logging for debugging
  useEffect(() => {
    if (!loading) {
      console.log(`[useFeatureFlag] Flag "${flag}":`, {
        enabled: isEnabled(flag),
        allFlags: flags,
        loading
      });
    }
  }, [flag, isEnabled, flags, loading]);
  
  return isEnabled(flag);
};
