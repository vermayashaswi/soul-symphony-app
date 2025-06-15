
import { useFeatureFlagsContext } from "../contexts/FeatureFlagsContext";
import { AppFeatureFlag } from "../types/featureFlags";

/**
 * Custom hook to easily check if a feature flag is enabled.
 * Example: const isEnabled = useFeatureFlag("smartChatV2");
 */
export const useFeatureFlag = (flag: AppFeatureFlag): boolean => {
  const { isEnabled } = useFeatureFlagsContext();
  return isEnabled(flag);
};
