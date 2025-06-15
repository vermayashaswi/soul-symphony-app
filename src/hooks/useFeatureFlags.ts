
import { useQuery } from '@tanstack/react-query';
import { fetchFeatureFlags } from '@/utils/featureFlagsClient';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

// Returns { isLoading, flags }
export function useFeatureFlags() {
  const { user } = useAuth();
  const { tier } = useSubscription();

  const userId = user?.id;
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature-flags', userId, tier],
    queryFn: () => fetchFeatureFlags({ userId, tier }),
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
  });

  return {
    isLoading,
    error,
    flags: data || [],
    hasFlag: (featureKey: string) => (data || []).includes(featureKey),
  };
}
