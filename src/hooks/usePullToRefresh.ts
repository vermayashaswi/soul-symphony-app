
import { useEffect, useCallback } from 'react';
import { pullToRefreshService } from '@/services/pullToRefreshService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  enabled?: boolean;
  threshold?: number;
  resistance?: number;
}

export const usePullToRefresh = ({
  onRefresh,
  enabled = true,
  threshold = 80,
  resistance = 0.5
}: UsePullToRefreshOptions) => {
  const handleRefresh = useCallback(async () => {
    console.log('[usePullToRefresh] Refresh triggered');
    await onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    // Only initialize in native apps
    if (!nativeIntegrationService.isRunningNatively()) {
      console.log('[usePullToRefresh] Not in native app, skipping');
      return;
    }

    if (enabled) {
      console.log('[usePullToRefresh] Initializing pull-to-refresh');
      pullToRefreshService.initialize({
        onRefresh: handleRefresh,
        threshold,
        resistance,
        enabled
      });
    }

    return () => {
      if (enabled) {
        pullToRefreshService.disable();
      }
    };
  }, [handleRefresh, enabled, threshold, resistance]);

  return {
    isNativeApp: nativeIntegrationService.isRunningNatively(),
    refresh: handleRefresh
  };
};
