
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { FeatureFlags, AppFeatureFlag } from "../types/featureFlags";
import { featureFlagService } from "../services/featureFlagService";
import { useAuth } from "./AuthContext";

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isEnabled: (flag: AppFeatureFlag) => boolean;
  isLoading: boolean;
  refreshFlags: () => Promise<void>;
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
  isLoading: true,
  refreshFlags: async () => {}
});

export const FeatureFlagsProvider = ({ children }: { children: ReactNode }) => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeFlags = async () => {
      try {
        setIsLoading(true);
        
        // Initialize the service
        await featureFlagService.initialize(user?.id);
        
        // Get initial flags
        setFlags(featureFlagService.getFlags());
        
        // Subscribe to changes
        unsubscribe = featureFlagService.subscribe((newFlags) => {
          console.log('[FeatureFlagsProvider] Flags updated:', newFlags);
          setFlags(newFlags);
        });
        
      } catch (error) {
        console.error('[FeatureFlagsProvider] Initialization failed:', error);
        // Use default flags on error
        setFlags(defaultFlags);
      } finally {
        setIsLoading(false);
      }
    };

    initializeFlags();

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id]);

  const isEnabled = (flag: AppFeatureFlag) => featureFlagService.isEnabled(flag);

  const refreshFlags = async () => {
    try {
      await featureFlagService.refresh(user?.id);
      setFlags(featureFlagService.getFlags());
    } catch (error) {
      console.error('[FeatureFlagsProvider] Refresh failed:', error);
    }
  };

  const value = React.useMemo(
    () => ({
      flags,
      isEnabled,
      isLoading,
      refreshFlags,
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
