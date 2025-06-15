
import React, { createContext, useContext } from 'react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface IFeatureFlagsContext {
  isLoading: boolean;
  error: any;
  flags: string[];
  hasFlag: (key: string) => boolean;
}

const FeatureFlagsContext = createContext<IFeatureFlagsContext>({
  isLoading: true,
  error: null,
  flags: [],
  hasFlag: () => false
});

export const FeatureFlagsProvider = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, error, flags, hasFlag } = useFeatureFlags();

  return (
    <FeatureFlagsContext.Provider value={{ isLoading, error, flags, hasFlag }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export function useFeatureFlagsContext() {
  return useContext(FeatureFlagsContext);
}
