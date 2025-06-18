
import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { FeatureFlags, AppFeatureFlag } from "../types/featureFlags";

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isEnabled: (flag: AppFeatureFlag) => boolean;
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
  isEnabled: () => false
});

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  // In a real app, fetch or compute flags here (e.g., from Supabase, API, etc).
  // For now, we use static defaults.
  const flags = defaultFlags;

  const isEnabled = (flag: AppFeatureFlag) => !!flags[flag];

  const value = useMemo(
    () => ({
      flags,
      isEnabled,
    }),
    [flags]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlagsContext = () => useContext(FeatureFlagsContext);
