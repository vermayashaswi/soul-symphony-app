
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

  const fetchFeatureFlags = async () => {
    try {
      console.log('[FeatureFlagsContext] Fetching feature flags from database...');
      
      const { data, error } = await supabase
        .from('feature_flags')
        .select('name, is_enabled');

      if (error) {
        console.error('[FeatureFlagsContext] Error fetching feature flags:', error);
        setLoading(false);
        return;
      }

      // Create a new flags object based on database results
      const updatedFlags = { ...defaultFlags };
      
      if (data) {
        data.forEach((flag) => {
          const flagKey = flag.name as AppFeatureFlag;
          if (flagKey in updatedFlags) {
            updatedFlags[flagKey] = flag.is_enabled;
            console.log(`[FeatureFlagsContext] Flag ${flagKey}:`, flag.is_enabled);
          }
        });
      }

      console.log('[FeatureFlagsContext] Updated flags:', updatedFlags);
      setFlags(updatedFlags);
    } catch (err) {
      console.error('[FeatureFlagsContext] Failed to fetch feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureFlags();

    // Set up real-time subscription for feature flag changes
    console.log('[FeatureFlagsContext] Setting up real-time subscription for feature flags');
    
    const channel = supabase
      .channel('feature-flags-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags'
        },
        (payload) => {
          console.log('[FeatureFlagsContext] Real-time feature flag change:', payload);
          
          // Refetch all flags when any flag changes to ensure consistency
          fetchFeatureFlags();
        }
      )
      .subscribe((status) => {
        console.log('[FeatureFlagsContext] Real-time subscription status:', status);
      });

    return () => {
      console.log('[FeatureFlagsContext] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  const isEnabled = (flag: AppFeatureFlag) => {
    const enabled = !!flags[flag];
    console.log(`[FeatureFlagsContext] Checking flag ${flag}:`, enabled);
    return enabled;
  };

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
