
import React, { createContext, useContext, useMemo, ReactNode, useEffect, useState } from "react";
import { FeatureFlags, AppFeatureFlag } from "../types/featureFlags";
import { supabase } from "@/integrations/supabase/client";

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isEnabled: (flag: AppFeatureFlag) => boolean;
  loading: boolean;
};

const defaultFlags: FeatureFlags = {
  smartChatV2: false,
  premiumMessaging: false,
  emotionCalendar: false,
  insightsV2: false,
  journalVoicePlayback: false,
  maintenanceBanner: false,
  otherReservedFlags: false,
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: defaultFlags,
  isEnabled: () => false,
  loading: true
});

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatureFlags = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('flag_name, is_enabled')
          .eq('is_enabled', true); // Only fetch enabled flags

        if (error) {
          console.error('Error fetching feature flags:', error);
          setLoading(false);
          return;
        }

        // Create a new flags object based on database results
        const updatedFlags = { ...defaultFlags };
        
        if (data) {
          data.forEach((flag) => {
            const flagKey = flag.flag_name as AppFeatureFlag;
            if (flagKey in updatedFlags) {
              updatedFlags[flagKey] = flag.is_enabled;
            }
          });
        }

        setFlags(updatedFlags);
      } catch (err) {
        console.error('Failed to fetch feature flags:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatureFlags();
  }, []);

  const isEnabled = (flag: AppFeatureFlag) => !!flags[flag];

  const value = useMemo(
    () => ({
      flags,
      isEnabled,
      loading,
    }),
    [flags, loading]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlagsContext = () => useContext(FeatureFlagsContext);
