
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';

export function useFeatureFlag(featureKey: string) {
  const { hasFlag, isLoading } = useFeatureFlagsContext();
  return { enabled: hasFlag(featureKey), isLoading };
}
