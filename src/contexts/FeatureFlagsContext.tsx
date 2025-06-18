
import React, { createContext, useContext, useMemo, ReactNode, useEffect, useState } from "react";
import { FeatureFlags, AppFeatureFlag } from "../types/featureFlags";
import { featureFlagService } from "../services/featureFlagService";

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isEnabled: (flag: AppFeatureFlag) => boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
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
  isLoading: false,
  refresh: async () => {}
});

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [isLoading, setIsLoading] = useState(true);

  const loadFlags = async () => {
    try {
      setIsLoading(true);
      const fetchedFlags = await featureFlagService.getFlags();
      setFlags(fetchedFlags);
    } catch (error) {
      console.error('[FeatureFlagsProvider] Error loading flags:', error);
      // Fall back to default flags
      setFlags(defaultFlags);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const isEnabled = (flag: AppFeatureFlag) => !!flags[flag];

  const refresh = async () => {
    featureFlagService.clearCache();
    await loadFlags();
  };

  const value = useMemo(
    () => ({
      flags,
      isEnabled,
      isLoading,
      refresh,
    }),
    [flags, isLoading]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlagsContext = () => useContext(FeatureFlagsContext);
