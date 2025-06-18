
import React, { createContext, useContext, useMemo, ReactNode, useEffect, useState } from "react";
import { FeatureFlags, AppFeatureFlag } from "../types/featureFlags";
import { supabase } from "@/integrations/supabase/client";

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isEnabled: (flag: AppFeatureFlag) => boolean;
  loading: boolean;
  lastUpdated: Date | null;
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
  loading: true,
  lastUpdated: null
});

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchFeatureFlags = async () => {
    try {
      console.log('[FeatureFlags] Fetching feature flags...');
      const { data, error } = await supabase
        .from('feature_flags')
        .select('name, is_enabled');

      if (error) {
        console.error('[FeatureFlags] Error fetching feature flags:', error);
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
          }
        });
      }

      console.log('[FeatureFlags] Updated flags:', updatedFlags);
      setFlags(updatedFlags);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[FeatureFlags] Failed to fetch feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchFeatureFlags();

    // Set up real-time subscription
    console.log('[FeatureFlags] Setting up real-time subscription...');
    const channel = supabase
      .channel('feature-flags-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'feature_flags'
        },
        (payload) => {
          console.log('[FeatureFlags] Real-time update received:', payload);
          // Refetch flags when any change occurs
          fetchFeatureFlags();
        }
      )
      .subscribe((status) => {
        console.log('[FeatureFlags] Subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('[FeatureFlags] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  const isEnabled = (flag: AppFeatureFlag) => !!flags[flag];

  const value = useMemo(
    () => ({
      flags,
      isEnabled,
      loading,
      lastUpdated,
    }),
    [flags, loading, lastUpdated]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlagsContext = () => useContext(FeatureFlagsContext);
