
import React, { createContext, useContext, useMemo, ReactNode, useEffect, useState } from "react";
import { FeatureFlags, AppFeatureFlag } from "../types/featureFlags";
import { supabase } from "@/integrations/supabase/client";
import { useSafeAuth } from "./AuthContext";

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isEnabled: (flag: AppFeatureFlag) => boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const defaultFlags: FeatureFlags = {
  smartChatV2: false,
  premiumMessaging: false,
  emotionCalendar: false,
  insightsV2: false,
  journalVoicePlayback: false,
  otherReservedFlags: false,
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: defaultFlags,
  isEnabled: () => false,
  loading: false,
  error: null,
  refetch: async () => {},
});

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const authContext = useSafeAuth();
  const user = authContext?.user || null;
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatureFlags = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all feature flags
      const { data: allFlags, error: flagsError } = await supabase
        .from('feature_flags')
        .select('*');

      if (flagsError) {
        console.error('Error fetching feature flags:', flagsError);
        setError('Failed to fetch feature flags');
        return;
      }

      // Fetch user-specific overrides if user is authenticated
      let userOverrides: any[] = [];
      if (user) {
        const { data: overrides, error: overridesError } = await supabase
          .from('user_feature_flags')
          .select('feature_flag_id, is_enabled')
          .eq('user_id' as any, user.id as any);

        if (overridesError) {
          console.warn('Error fetching user feature flag overrides:', overridesError);
        } else {
          userOverrides = overrides || [];
        }
      }

      // Build flags object
      const computedFlags: FeatureFlags = { ...defaultFlags };

      allFlags?.forEach((flag: any) => {
        if (flag?.name in computedFlags) {
          // Check for user-specific override first
          const userOverride = userOverrides.find(o => o.feature_flag_id === flag.id);
          if (userOverride) {
            computedFlags[flag.name as AppFeatureFlag] = userOverride.is_enabled;
          } else {
            // Use global flag setting with rollout percentage
            const shouldEnable = flag.is_enabled && (
              flag.rollout_percentage === 100 || 
              Math.random() * 100 < flag.rollout_percentage
            );
            computedFlags[flag.name as AppFeatureFlag] = shouldEnable;
          }
        }
      });

      setFlags(computedFlags);
    } catch (err) {
      console.error('Unexpected error fetching feature flags:', err);
      setError('Unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch flags on mount and when user changes
  useEffect(() => {
    fetchFeatureFlags();
  }, [user?.id]);

  const isEnabled = (flag: AppFeatureFlag) => !!flags[flag];

  const value = useMemo(
    () => ({
      flags,
      isEnabled,
      loading,
      error,
      refetch: fetchFeatureFlags,
    }),
    [flags, loading, error]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlagsContext = () => useContext(FeatureFlagsContext);
