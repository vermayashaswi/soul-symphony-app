
import React, { useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { CacheBustingService } from '@/services/cacheBustingService';

const MaintenanceBanner: React.FC = () => {
  const isMaintenanceEnabled = useFeatureFlag('maintenanceBanner');
  const { loading, lastUpdated } = useFeatureFlagsContext();

  // Perform cache busting check on component mount
  useEffect(() => {
    CacheBustingService.performCacheBustingCheck();
  }, []);

  // Enhanced logging for debugging
  useEffect(() => {
    console.log('[MaintenanceBanner] State:', {
      isMaintenanceEnabled,
      loading,
      lastUpdated: lastUpdated?.toISOString(),
      cacheVersion: CacheBustingService.getCacheVersion(),
      userAgent: navigator.userAgent,
      location: window.location.href
    });
  }, [isMaintenanceEnabled, loading, lastUpdated]);

  // Don't render while loading
  if (loading) {
    console.log('[MaintenanceBanner] Still loading feature flags...');
    return null;
  }

  if (!isMaintenanceEnabled) {
    console.log('[MaintenanceBanner] Maintenance banner is disabled');
    return null;
  }

  console.log('[MaintenanceBanner] Rendering maintenance banner');

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white shadow-lg">
      <Alert className="rounded-none border-0 bg-orange-500 text-white p-3">
        <AlertTriangle className="h-4 w-4 text-white" />
        <AlertDescription className="text-white font-medium text-sm">
          🔧 We're performing maintenance to improve your experience. Some features may be temporarily unavailable.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default MaintenanceBanner;
